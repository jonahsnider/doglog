//! Signs in to Cloud with macOS's own passkey sheet. It only works in a build signed with
//! `Entitlements.plist` and its provisioning profile, other builds, ex. `tauri dev`, sign in through the browser.

use std::{cell::RefCell, ptr};

use base64::{Engine, prelude::BASE64_URL_SAFE_NO_PAD};
use dispatch2::{DispatchQueue, MainThreadBound};
use objc2::{
    AnyThread, DefinedClass, MainThreadMarker, MainThreadOnly, Message, define_class, msg_send,
    rc::Retained,
    runtime::{AnyObject, ProtocolObject},
};
use objc2_app_kit::NSWindow;
use objc2_authentication_services::{
    ASAuthorization, ASAuthorizationAllSupportedPublicKeyCredentialDescriptorTransports, ASAuthorizationController,
    ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding, ASAuthorizationError,
    ASAuthorizationPlatformPublicKeyCredentialAssertion, ASAuthorizationPlatformPublicKeyCredentialProvider,
    ASAuthorizationPlatformPublicKeyCredentialRegistration, ASAuthorizationPublicKeyCredentialAssertion,
    ASAuthorizationPublicKeyCredentialAssertionRequest, ASAuthorizationPublicKeyCredentialParameters,
    ASAuthorizationPublicKeyCredentialRegistration, ASAuthorizationPublicKeyCredentialRegistrationRequest,
    ASAuthorizationPublicKeyCredentialResidentKeyPreferenceRequired,
    ASAuthorizationPublicKeyCredentialUserVerificationPreferenceRequired, ASAuthorizationRequest,
    ASAuthorizationSecurityKeyPublicKeyCredentialAssertion, ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor,
    ASAuthorizationSecurityKeyPublicKeyCredentialProvider, ASAuthorizationSecurityKeyPublicKeyCredentialRegistration,
    ASCOSEAlgorithmIdentifierES256, ASPresentationAnchor, ASPublicKeyCredential,
};
use objc2_core_foundation::CFString;
use objc2_foundation::{NSArray, NSData, NSError, NSObject, NSObjectProtocol, NSString};
use objc2_security::SecTask;
use serde::Deserialize;
use serde_json::{Value, json};
use tauri::WebviewWindow;
use tokio::sync::oneshot;

use super::NativeSignInError;

fn has_entitlement(name: &str) -> bool {
    let Some(task) = (unsafe { SecTask::from_self(None) }) else {
        return false;
    };
    unsafe { task.value_for_entitlement(&CFString::from_str(name), ptr::null_mut()) }.is_some()
}

/// Unsigned builds, ex. `tauri dev`, don't have the entitlement macOS needs to show its sheet
pub fn supported() -> bool {
    has_entitlement("com.apple.developer.associated-domains")
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreationOptions {
    rp: RelyingParty,
    user: User,
    challenge: String,
    #[serde(default)]
    exclude_credentials: Vec<Descriptor>,
}

#[derive(Deserialize)]
pub struct RelyingParty {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    id: String,
    name: String,
    display_name: String,
}

#[derive(Deserialize)]
pub struct Descriptor {
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestOptions {
    rp_id: String,
    challenge: String,
}

/// A passkey ceremony with the WebAuthn JSON options Cloud returned. Cloud always asks for discoverable credentials and
/// user verification, see `cloud/convex/auth.ts`.
#[derive(Deserialize)]
#[serde(tag = "ceremony", content = "options", rename_all = "lowercase")]
pub enum PasskeyRequest {
    Register(CreationOptions),
    Authenticate(RequestOptions),
}

fn decode(text: &str) -> Result<Retained<NSData>, NativeSignInError> {
    let bytes = BASE64_URL_SAFE_NO_PAD
        .decode(text.trim_end_matches('='))
        .map_err(|error| NativeSignInError::failed(error.to_string()))?;
    Ok(NSData::with_bytes(&bytes))
}

fn encode(data: Retained<NSData>) -> String {
    BASE64_URL_SAFE_NO_PAD.encode(data.to_vec())
}

/// Turns the credential into JSON on the main thread, since it can't leave it
type Convert = fn(&ASAuthorization) -> Result<Value, NativeSignInError>;

struct Ivars {
    window: Retained<NSWindow>,
    reply: RefCell<Option<oneshot::Sender<Result<Value, NativeSignInError>>>>,
    convert: Convert,
}

define_class!(
    // SAFETY: NSObject has no subclassing requirements and this class doesn't implement `Drop`
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[ivars = Ivars]
    struct SignInDelegate;

    unsafe impl NSObjectProtocol for SignInDelegate {}

    unsafe impl ASAuthorizationControllerDelegate for SignInDelegate {
        #[unsafe(method(authorizationController:didCompleteWithAuthorization:))]
        fn did_complete(&self, _controller: &ASAuthorizationController, authorization: &ASAuthorization) {
            self.finish((self.ivars().convert)(authorization));
        }

        #[unsafe(method(authorizationController:didCompleteWithError:))]
        fn did_fail(&self, _controller: &ASAuthorizationController, error: &NSError) {
            let code = ASAuthorizationError(error.code());
            self.finish(Err(if code == ASAuthorizationError::Canceled {
                NativeSignInError::Canceled
            } else if code == ASAuthorizationError::MatchedExcludedCredential {
                NativeSignInError::Excluded
            } else {
                NativeSignInError::failed(error.localizedDescription().to_string())
            }));
        }
    }

    unsafe impl ASAuthorizationControllerPresentationContextProviding for SignInDelegate {
        #[unsafe(method_id(presentationAnchorForAuthorizationController:))]
        fn presentation_anchor(&self, _controller: &ASAuthorizationController) -> Retained<ASPresentationAnchor> {
            Retained::into_super(Retained::into_super(self.ivars().window.clone()))
        }
    }
);

thread_local! {
    /// The sign-in that's showing, kept alive until it finishes since the controller only weakly holds its delegate
    static PENDING: RefCell<Option<(Retained<ASAuthorizationController>, Retained<SignInDelegate>)>> =
        RefCell::default();
}

impl SignInDelegate {
    fn finish(&self, result: Result<Value, NativeSignInError>) {
        if let Some(reply) = self.ivars().reply.take() {
            let _ = reply.send(result);
        }
        let finished = PENDING.with_borrow_mut(|pending| {
            if pending.as_ref().is_some_and(|(_, delegate)| ptr::eq(&**delegate, self)) {
                pending.take()
            } else {
                None
            }
        });
        // The controller is still calling this delegate, so release them once it returns
        let finished = MainThreadBound::new(finished, self.mtm());
        DispatchQueue::main().exec_async(move || drop(finished.into_inner(MainThreadMarker::new().unwrap())));
    }
}

/// Shows the OS's sheet for `requests` over `window`. Starting another sign-in cancels the one showing.
async fn perform(
    window: &WebviewWindow,
    requests: impl FnOnce() -> Result<Vec<Retained<ASAuthorizationRequest>>, NativeSignInError> + Send + 'static,
    convert: Convert,
) -> Result<Value, NativeSignInError> {
    let (send, receive) = oneshot::channel();
    window
        .with_webview(move |webview| {
            // Tauri runs this on the main thread with the window's live NSWindow
            let mtm = MainThreadMarker::new().unwrap();
            let requests = match requests() {
                Ok(requests) => requests,
                Err(error) => {
                    let _ = send.send(Err(error));
                    return;
                }
            };
            let Some(ns_window) = (unsafe { Retained::retain(webview.ns_window().cast::<NSWindow>()) }) else {
                return;
            };
            let delegate = mtm.alloc::<SignInDelegate>().set_ivars(Ivars {
                window: ns_window,
                reply: RefCell::new(Some(send)),
                convert,
            });
            let delegate: Retained<SignInDelegate> = unsafe { msg_send![super(delegate), init] };
            let controller = unsafe {
                ASAuthorizationController::initWithAuthorizationRequests(
                    ASAuthorizationController::alloc(),
                    &NSArray::from_retained_slice(&requests),
                )
            };
            unsafe {
                controller.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
                controller.setPresentationContextProvider(Some(ProtocolObject::from_ref(&*delegate)));
            }
            let previous = PENDING.replace(Some((controller.clone(), delegate)));
            if let Some((previous, _)) = previous {
                // Its delegate is released, so the earlier sign-in resolves as canceled
                unsafe { previous.cancel() };
            }
            unsafe { controller.performRequests() };
        })
        .map_err(|error| NativeSignInError::failed(error.to_string()))?;
    receive.await.unwrap_or(Err(NativeSignInError::Canceled))
}

fn registration_requests(options: CreationOptions) -> Result<Vec<Retained<ASAuthorizationRequest>>, NativeSignInError> {
    let challenge = decode(&options.challenge)?;
    let user_id = decode(&options.user.id)?;
    let rp_id = NSString::from_str(&options.rp.id);
    let name = NSString::from_str(&options.user.name);
    let user_verification = unsafe { ASAuthorizationPublicKeyCredentialUserVerificationPreferenceRequired }.unwrap();
    unsafe {
        let platform = ASAuthorizationPlatformPublicKeyCredentialProvider::initWithRelyingPartyIdentifier(
            ASAuthorizationPlatformPublicKeyCredentialProvider::alloc(),
            &rp_id,
        )
        .createCredentialRegistrationRequestWithChallenge_name_userID(&challenge, &name, &user_id);
        platform.setUserVerificationPreference(user_verification);

        let security_key = ASAuthorizationSecurityKeyPublicKeyCredentialProvider::initWithRelyingPartyIdentifier(
            ASAuthorizationSecurityKeyPublicKeyCredentialProvider::alloc(),
            &rp_id,
        )
        .createCredentialRegistrationRequestWithChallenge_displayName_name_userID(
            &challenge,
            &NSString::from_str(&options.user.display_name),
            &name,
            &user_id,
        );
        security_key.setUserVerificationPreference(user_verification);
        security_key.setResidentKeyPreference(ASAuthorizationPublicKeyCredentialResidentKeyPreferenceRequired.unwrap());
        // Security keys only support ES256 here, which Cloud accepts
        security_key.setCredentialParameters(&NSArray::from_retained_slice(&[
            ASAuthorizationPublicKeyCredentialParameters::initWithAlgorithm(
                ASAuthorizationPublicKeyCredentialParameters::alloc(),
                ASCOSEAlgorithmIdentifierES256,
            ),
        ]));
        let transports = ASAuthorizationAllSupportedPublicKeyCredentialDescriptorTransports();
        let excluded = options
            .exclude_credentials
            .iter()
            .map(|descriptor| {
                Ok(
                    ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor::initWithCredentialID_transports(
                        ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor::alloc(),
                        &*decode(&descriptor.id)?,
                        &transports,
                    ),
                )
            })
            .collect::<Result<Vec<_>, NativeSignInError>>()?;
        security_key.setExcludedCredentials(&NSArray::from_retained_slice(&excluded));

        Ok(vec![Retained::into_super(platform), Retained::into_super(security_key)])
    }
}

fn assertion_requests(options: RequestOptions) -> Result<Vec<Retained<ASAuthorizationRequest>>, NativeSignInError> {
    let challenge = decode(&options.challenge)?;
    let rp_id = NSString::from_str(&options.rp_id);
    let user_verification = unsafe { ASAuthorizationPublicKeyCredentialUserVerificationPreferenceRequired }.unwrap();
    unsafe {
        let platform = ASAuthorizationPlatformPublicKeyCredentialProvider::initWithRelyingPartyIdentifier(
            ASAuthorizationPlatformPublicKeyCredentialProvider::alloc(),
            &rp_id,
        )
        .createCredentialAssertionRequestWithChallenge(&challenge);
        platform.setUserVerificationPreference(user_verification);
        let security_key = ASAuthorizationSecurityKeyPublicKeyCredentialProvider::initWithRelyingPartyIdentifier(
            ASAuthorizationSecurityKeyPublicKeyCredentialProvider::alloc(),
            &rp_id,
        )
        .createCredentialAssertionRequestWithChallenge(&challenge);
        security_key.setUserVerificationPreference(user_verification);
        Ok(vec![Retained::into_super(platform), Retained::into_super(security_key)])
    }
}

fn credential_id<T: ASPublicKeyCredential + Message>(credential: &T) -> (String, String) {
    let id = encode(unsafe { credential.credentialID() });
    (id, encode(unsafe { credential.rawClientDataJSON() }))
}

fn registration_json<T: ASAuthorizationPublicKeyCredentialRegistration + Message>(
    credential: &T,
) -> Result<Value, NativeSignInError> {
    let (id, client_data) = credential_id(credential);
    let attestation = unsafe { credential.rawAttestationObject() }
        .ok_or_else(|| NativeSignInError::failed("The passkey didn't return an attestation".into()))?;
    Ok(json!({
        "id": id,
        "rawId": id,
        "type": "public-key",
        "response": { "clientDataJSON": client_data, "attestationObject": encode(attestation) },
    }))
}

fn assertion_json<T: ASAuthorizationPublicKeyCredentialAssertion + Message>(credential: &T) -> Value {
    let (id, client_data) = credential_id(credential);
    let user_handle = unsafe { credential.userID() };
    json!({
        "id": id,
        "rawId": id,
        "type": "public-key",
        "response": {
            "clientDataJSON": client_data,
            "authenticatorData": encode(unsafe { credential.rawAuthenticatorData() }),
            "signature": encode(unsafe { credential.signature() }),
            "userHandle": (user_handle.length() > 0).then(|| encode(user_handle)),
        },
    })
}

fn credential(authorization: &ASAuthorization) -> Retained<AnyObject> {
    let credential = unsafe { authorization.credential() };
    // SAFETY: Every credential is an object
    unsafe { Retained::cast_unchecked(credential) }
}

fn unexpected() -> NativeSignInError {
    NativeSignInError::failed("The OS returned an unexpected credential".into())
}

fn convert_registration(authorization: &ASAuthorization) -> Result<Value, NativeSignInError> {
    let credential = credential(authorization);
    if let Some(credential) = credential.downcast_ref::<ASAuthorizationPlatformPublicKeyCredentialRegistration>() {
        registration_json(credential)
    } else if let Some(credential) =
        credential.downcast_ref::<ASAuthorizationSecurityKeyPublicKeyCredentialRegistration>()
    {
        registration_json(credential)
    } else {
        Err(unexpected())
    }
}

fn convert_assertion(authorization: &ASAuthorization) -> Result<Value, NativeSignInError> {
    let credential = credential(authorization);
    if let Some(credential) = credential.downcast_ref::<ASAuthorizationPlatformPublicKeyCredentialAssertion>() {
        Ok(assertion_json(credential))
    } else if let Some(credential) = credential.downcast_ref::<ASAuthorizationSecurityKeyPublicKeyCredentialAssertion>()
    {
        Ok(assertion_json(credential))
    } else {
        Err(unexpected())
    }
}

/// Runs a passkey ceremony, resolving with the WebAuthn JSON response for Cloud
#[tauri::command]
pub async fn native_passkey(window: WebviewWindow, request: PasskeyRequest) -> Result<Value, NativeSignInError> {
    match request {
        PasskeyRequest::Register(options) => {
            perform(&window, move || registration_requests(options), convert_registration).await
        }
        PasskeyRequest::Authenticate(options) => {
            perform(&window, move || assertion_requests(options), convert_assertion).await
        }
    }
}
