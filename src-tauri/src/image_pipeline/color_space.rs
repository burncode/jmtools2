use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MattingColorSpace {
    #[default]
    Rgb,
    YCbCr,
}

impl MattingColorSpace {
    pub fn from_option(value: Option<&str>) -> Self {
        match value.unwrap_or("rgb").trim().to_ascii_lowercase().as_str() {
            "ycbcr" | "yuv" => Self::YCbCr,
            _ => Self::Rgb,
        }
    }
}

pub fn color_distance(color: [u8; 3], background: [u8; 3], space: MattingColorSpace) -> f32 {
    match space {
        MattingColorSpace::Rgb => rgb_color_distance(color, background),
        MattingColorSpace::YCbCr => ycbcr_color_distance(color, background),
    }
}

fn rgb_color_distance(color: [u8; 3], background: [u8; 3]) -> f32 {
    let red = color[0] as f32 - background[0] as f32;
    let green = color[1] as f32 - background[1] as f32;
    let blue = color[2] as f32 - background[2] as f32;

    (red * red + green * green + blue * blue).sqrt()
}

fn rgb_to_ycbcr(color: [u8; 3]) -> [f32; 3] {
    let red = color[0] as f32;
    let green = color[1] as f32;
    let blue = color[2] as f32;
    let y = 0.299 * red + 0.587 * green + 0.114 * blue;
    let cb = 128.0 - 0.168_736 * red - 0.331_264 * green + 0.5 * blue;
    let cr = 128.0 + 0.5 * red - 0.418_688 * green - 0.081_312 * blue;

    [y, cb, cr]
}

fn ycbcr_color_distance(color: [u8; 3], background: [u8; 3]) -> f32 {
    let left = rgb_to_ycbcr(color);
    let right = rgb_to_ycbcr(background);
    let dy = left[0] - right[0];
    let dcb = left[1] - right[1];
    let dcr = left[2] - right[2];

    (dy * dy * 0.25 + dcb * dcb + dcr * dcr).sqrt()
}
