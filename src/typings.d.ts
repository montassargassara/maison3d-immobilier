declare module '@mkkellogg/gaussian-splats-3d' {
  export enum WebXRMode { None = 0, VR = 1, AR = 2 }
  export enum RenderMode { Always = 0, OnChange = 1, Never = 2 }
  export enum SceneRevealMode { Default = 0, Gradual = 1, Instant = 2 }
  export enum LogLevel { None = 0, Error = 1, Warning = 2, Info = 3, Debug = 4 }

  export interface ViewerOptions {
    rootElement?: HTMLElement;
    selfDrivenMode?: boolean;
    renderer?: unknown;
    camera?: unknown;
    useBuiltInControls?: boolean;
    ignoreDevicePixelRatio?: boolean;
    gpuAcceleratedSort?: boolean;
    halfPrecisionCovariancesOnGPU?: boolean;
    sharedMemoryForWorkers?: boolean;
    integerBasedSort?: boolean;
    dynamicScene?: boolean;
    webXRMode?: WebXRMode;
    renderMode?: RenderMode;
    sceneRevealMode?: SceneRevealMode;
    logLevel?: LogLevel;
    sphericalHarmonicsDegree?: number;
  }

  export interface SplatSceneOptions {
    splatAlphaRemovalThreshold?: number;
    showLoadingUI?: boolean;
    progressiveLoad?: boolean;
  }

  export class Viewer {
    constructor(options?: ViewerOptions);
    addSplatScene(path: string, options?: SplatSceneOptions): Promise<void>;
    start(): void;
    stop(): void;
    dispose(): void;
  }
}
