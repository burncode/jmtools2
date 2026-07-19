import { Application } from "pixi.js";

export interface CreatePixiApplicationOptions {
  antialias?: boolean;
  backgroundColor?: number;
  height: number;
  resolution?: number;
  width: number;
}

export async function createPixiApplication(options: CreatePixiApplicationOptions) {
  const app = new Application();

  await app.init({
    antialias: options.antialias ?? false,
    backgroundColor: options.backgroundColor ?? 0x171714,
    height: options.height,
    resolution: options.resolution ?? window.devicePixelRatio,
    width: options.width,
  });

  return app;
}
