// 教學簡報產生器 — Tauri 入口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    course_slide_generator_lib::run()
}
