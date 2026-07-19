use std::time::Instant;

use tracing::info;

pub struct CommandSpanGuard {
    command: String,
    target: &'static str,
    started_at: Instant,
    task_id: Option<String>,
    run_id: Option<String>,
    failed: bool,
}

impl CommandSpanGuard {
    pub fn enter(command: impl Into<String>, target: &'static str) -> Self {
        let command = command.into();
        info!(target, command = %command, "command started");
        Self {
            command,
            target,
            started_at: Instant::now(),
            task_id: None,
            run_id: None,
            failed: false,
        }
    }

    pub fn with_task_id(mut self, task_id: impl Into<String>) -> Self {
        self.task_id = Some(task_id.into());
        self
    }

    pub fn with_run_id(mut self, run_id: impl Into<String>) -> Self {
        self.run_id = Some(run_id.into());
        self
    }

    pub fn mark_failed(&mut self) {
        self.failed = true;
    }
}

impl Drop for CommandSpanGuard {
    fn drop(&mut self) {
        let duration_ms = self.started_at.elapsed().as_millis() as u64;
        let task_id = self.task_id.as_deref().unwrap_or("");
        let run_id = self.run_id.as_deref().unwrap_or("");

        if self.failed {
            tracing::error!(
                target = self.target,
                command = %self.command,
                task_id,
                run_id,
                duration_ms,
                "command failed"
            );
        } else {
            info!(
                target = self.target,
                command = %self.command,
                task_id,
                run_id,
                duration_ms,
                "command finished"
            );
        }
    }
}
