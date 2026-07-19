mod filmstrip_filmstrip;
mod filmstrip_generate;
mod filmstrip_post;
mod filmstrip_prompt;
pub(crate) mod tracks;

pub(crate) use filmstrip_prompt::ActionFrameGenerationOptions;
pub(crate) use filmstrip_generate::workflow_generate_action_frames;
pub(crate) use filmstrip_post::workflow_post_process_action_frames;
pub(crate) use filmstrip_prompt::resolve_loop_mode;
