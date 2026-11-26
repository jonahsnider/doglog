//! Runs against the roboRIO and Systemcore stand-ins in `tests/roborio` and `tests/systemcore`, which each test starts with Docker.
//! Ignored by default so `cargo test` works without Docker, run with `cargo test -p robot-sftp -- --include-ignored`.

use std::sync::atomic::AtomicBool;

use robot_sftp::{LOG_DIRS, Robot};
use testcontainers::{
    ContainerAsync, GenericBuildableImage, GenericImage,
    core::{IntoContainerPort, WaitFor},
    runners::{AsyncBuilder, AsyncRunner},
};

const MATCH_LOG: &str = "/media/sda1/logs/FRC_20260315_143000_CAPH_Q12.wpilog";

/// Start the stand-in for `robot` (`roborio` or `systemcore`) and connect to it, the container is removed when it's dropped
async fn connect(robot: &str) -> (ContainerAsync<GenericImage>, Robot) {
    let container = GenericBuildableImage::new(format!("doglog-{robot}"), "test")
        .with_dockerfile(format!("{}/tests/{robot}/Dockerfile", env!("CARGO_MANIFEST_DIR")))
        .build_image()
        .await
        .unwrap()
        .with_exposed_port(22.tcp())
        .with_wait_for(WaitFor::message_on_either_std("Server listening"))
        .start()
        .await
        .unwrap();
    let host = container.get_host().await.unwrap().to_string();
    let port = container.get_host_port_ipv4(22).await.unwrap();
    let robot = Robot::connect(&host, port).await.unwrap();
    (container, robot)
}

#[tokio::test]
#[ignore = "needs the roboRIO container"]
async fn lists_logs_once_from_each_directory() {
    let (_container, robot) = connect("roborio").await;
    let mut logs = robot.list_logs(&LOG_DIRS).await.unwrap();
    logs.sort_by(|a, b| a.name.cmp(&b.name));

    let names: Vec<_> = logs.iter().map(|log| (log.path.as_str(), log.size)).collect();
    assert_eq!(
        names,
        [
            ("/home/lvuser/logs/FRC_20260314_090000.wpilog", 2000),
            (MATCH_LOG, 300_000),
            ("/media/sda1/logs/akit_26-03-15_14-30-00.wpilog", 1000),
        ]
    );
}

#[tokio::test]
#[ignore = "needs the roboRIO container"]
async fn skips_missing_directories() {
    let (_container, robot) = connect("roborio").await;
    let logs = robot.list_logs(&["/v/logs", "/home/lvuser/logs"]).await.unwrap();
    assert_eq!(logs.len(), 1);
}

#[tokio::test]
#[ignore = "needs the roboRIO container"]
async fn resumes_a_partial_download() {
    let (_container, robot) = connect("roborio").await;
    let dir = std::env::temp_dir().join(format!("robot-sftp-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let full = dir.join("full.wpilog");
    let partial = dir.join("partial.wpilog");
    let _ = std::fs::remove_file(&full);
    let _ = std::fs::remove_file(&partial);

    let cancel = AtomicBool::new(false);
    let copied = robot.download(MATCH_LOG, &full, 0, &cancel, |_| {}).await.unwrap();
    assert_eq!(copied, 300_000);

    let expected = std::fs::read(&full).unwrap();
    std::fs::write(&partial, &expected[..100_000]).unwrap();
    let copied = robot
        .download(MATCH_LOG, &partial, 100_000, &cancel, |_| {})
        .await
        .unwrap();
    assert_eq!(copied, 200_000);
    assert_eq!(std::fs::read(&partial).unwrap(), expected);

    // A local file that doesn't match the offset would be corrupted by appending to it
    assert!(
        robot
            .download(MATCH_LOG, &partial, 100_000, &cancel, |_| {})
            .await
            .is_err()
    );

    std::fs::remove_dir_all(&dir).unwrap();
}

#[tokio::test]
#[ignore = "needs the roboRIO container"]
async fn stops_when_cancelled() {
    let (_container, robot) = connect("roborio").await;
    let local = std::env::temp_dir().join(format!("robot-sftp-cancel-{}.wpilog", std::process::id()));
    let _ = std::fs::remove_file(&local);

    let cancel = AtomicBool::new(false);
    let copied = robot
        .download(MATCH_LOG, &local, 0, &cancel, |_| {
            cancel.store(true, std::sync::atomic::Ordering::Relaxed)
        })
        .await
        .unwrap();
    assert!(copied < 300_000);
    assert_eq!(std::fs::metadata(&local).unwrap().len(), copied);

    std::fs::remove_file(&local).unwrap();
}

#[tokio::test]
#[ignore = "needs the Systemcore container"]
async fn lists_logs_from_a_systemcore() {
    let (_container, robot) = connect("systemcore").await;
    let mut logs = robot.list_logs(&LOG_DIRS).await.unwrap();
    logs.sort_by(|a, b| a.name.cmp(&b.name));

    let names: Vec<_> = logs.iter().map(|log| (log.path.as_str(), log.size)).collect();
    assert_eq!(
        names,
        [
            ("/home/systemcore/logs/WPILIB_20270314_090000.wpilog", 2000),
            ("/U/logs/WPILIB_20270315_143000_CAPH_Q12.wpilog", 3000),
        ]
    );
}
