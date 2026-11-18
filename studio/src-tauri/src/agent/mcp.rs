//! `doglog mcp`, an MCP server over stdio that runs agent commands in Studio windows

use super::{API, block_on, bridge};
use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, ContentBlock, Implementation, ListToolsResult,
    PaginatedRequestParams, ServerCapabilities, ServerConfig, Tool,
};
use rmcp::service::RequestContext;
use rmcp::{ErrorData, RoleServer, ServerHandler, ServiceExt};
use serde_json::{Value, json};
use std::process::ExitCode;

struct Server {
    version: String,
}

/// Every command as a tool, with a `window` input for commands that run in a window
fn tools() -> Vec<Tool> {
    API.commands
        .iter()
        .map(|command| {
            let mut schema = command.input_schema.clone();
            if !command.bridge
                && let Value::Object(properties) = schema.entry("properties").or_insert_with(|| json!({}))
            {
                properties.insert(
                    "window".to_owned(),
                    json!({
                        "type": "string",
                        "description": "ID of the window to run this in, from window_list. Defaults to the most recently focused window.",
                    }),
                );
            }
            Tool::new(command.name.clone(), command.description.clone(), schema)
        })
        .collect()
}

impl ServerHandler for Server {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("doglog", &self.version))
            .with_instructions(&API.instructions)
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, ErrorData> {
        Ok(ListToolsResult::with_all_items(tools()))
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, ErrorData> {
        let Some(command) = API.commands.iter().find(|command| command.name == request.name) else {
            return Err(ErrorData::invalid_params(
                format!("There's no {} tool", request.name),
                None,
            ));
        };
        let mut args = request.arguments.unwrap_or_default();
        let result = if command.bridge {
            bridge::window_list().await
        } else {
            match args.remove("window") {
                None => bridge::call(&command.name, args.into(), None).await,
                Some(Value::String(window)) => bridge::call(&command.name, args.into(), Some(&window)).await,
                Some(_) => Err("window must be a window ID string".to_owned()),
            }
        };
        Ok(match result {
            Ok(value) => CallToolResult::success(vec![ContentBlock::text(value.to_string())]),
            Err(message) => CallToolResult::error(vec![ContentBlock::text(message)]),
        }
        .into())
    }
}

/// Serve MCP over stdio until the client disconnects
pub fn run(version: String) -> ExitCode {
    let result = block_on(async {
        Server { version }
            .serve(rmcp::transport::stdio())
            .await?
            .waiting()
            .await?;
        Ok::<_, Box<dyn std::error::Error>>(())
    });
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}
