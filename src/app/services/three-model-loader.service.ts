import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export type ModelFormat = 'glb' | 'gltf' | 'ply' | 'obj' | 'fbx' | 'unknown';

export interface LoadResult {
  object: THREE.Object3D;
  format: ModelFormat;
  isPointCloud: boolean;
}

@Injectable({ providedIn: 'root' })
export class ThreeModelLoaderService {
  private readonly dracoLoader: DRACOLoader;

  constructor() {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(
      'https://www.gstatic.com/draco/versioned/decoders/1.5.6/',
    );
  }

  /** Detect format from URL extension or an explicit format hint. */
  detectFormat(url: string, hint?: string): ModelFormat {
    if (hint) {
      const h = hint.toLowerCase().replace('.', '') as ModelFormat;
      if (['glb', 'gltf', 'ply', 'obj', 'fbx'].includes(h)) return h;
    }
    const clean = url.split('?')[0].toLowerCase();
    if (clean.endsWith('.glb')) return 'glb';
    if (clean.endsWith('.gltf')) return 'gltf';
    if (clean.endsWith('.ply')) return 'ply';
    if (clean.endsWith('.obj')) return 'obj';
    if (clean.endsWith('.fbx')) return 'fbx';
    return 'unknown';
  }

  load(
    url: string,
    onProgress?: (pct: number) => void,
    formatHint?: string,
  ): Promise<LoadResult> {
    const format = this.detectFormat(url, formatHint);
    switch (format) {
      case 'glb':
      case 'gltf':
        return this.loadGLTF(url, format, onProgress);
      case 'ply':
        return this.loadPLY(url, onProgress);
      case 'obj':
        return this.loadOBJ(url, onProgress);
      case 'fbx':
        return this.loadFBX(url, onProgress);
      default:
        // No extension in URL (e.g. /api/models/public/123) — default to GLTF loader
        return this.loadGLTF(url, 'glb', onProgress);
    }
  }

  // ─── GLTF / GLB ────────────────────────────────────────────────────────────

  private loadGLTF(
    url: string,
    format: 'glb' | 'gltf',
    onProgress?: (pct: number) => void,
  ): Promise<LoadResult> {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.setDRACOLoader(this.dracoLoader);
      loader.load(
        url,
        (gltf) => {
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.envMapIntensity = 1.2;
              }
            }
          });
          resolve({ object: gltf.scene, format, isPointCloud: false });
        },
        (evt) => onProgress?.(evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0),
        (err) => reject(err),
      );
    });
  }

  // ─── PLY ───────────────────────────────────────────────────────────────────

  private loadPLY(
    url: string,
    onProgress?: (pct: number) => void,
  ): Promise<LoadResult> {
    return new Promise((resolve, reject) => {
      const loader = new PLYLoader();
      loader.load(
        url,
        (geometry) => {
          geometry.computeVertexNormals();

          // geometry.index === null → no faces → point cloud
          const isPointCloud = geometry.index === null;
          const hasColor = geometry.hasAttribute('color');

          let object: THREE.Object3D;

          if (isPointCloud) {
            const mat = new THREE.PointsMaterial({
              size: 0.015,
              sizeAttenuation: true,
              vertexColors: hasColor,
              color: hasColor ? 0xffffff : 0x6366f1,
            });
            object = new THREE.Points(geometry, mat);
          } else {
            const mat = new THREE.MeshStandardMaterial({
              vertexColors: hasColor,
              color: hasColor ? 0xffffff : 0xc8a96e,
              roughness: 0.65,
              metalness: 0.05,
            });
            const mesh = new THREE.Mesh(geometry, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            object = mesh;
          }

          resolve({ object, format: 'ply', isPointCloud });
        },
        (evt) => onProgress?.(evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0),
        (err) => reject(err),
      );
    });
  }

  // ─── OBJ ───────────────────────────────────────────────────────────────────

  private loadOBJ(
    url: string,
    onProgress?: (pct: number) => void,
  ): Promise<LoadResult> {
    return new Promise((resolve, reject) => {
      const loader = new OBJLoader();
      loader.load(
        url,
        (obj) => {
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (!(child.material instanceof THREE.MeshStandardMaterial)) {
                child.material = new THREE.MeshStandardMaterial({
                  color: 0xc8a96e,
                  roughness: 0.65,
                  metalness: 0.05,
                });
              }
            }
          });
          resolve({ object: obj, format: 'obj', isPointCloud: false });
        },
        (evt) => onProgress?.(evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0),
        (err) => reject(err),
      );
    });
  }

  // ─── FBX ───────────────────────────────────────────────────────────────────

  private loadFBX(
    url: string,
    onProgress?: (pct: number) => void,
  ): Promise<LoadResult> {
    return new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      loader.load(
        url,
        (obj) => {
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          resolve({ object: obj, format: 'fbx', isPointCloud: false });
        },
        (evt) => onProgress?.(evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0),
        (err) => reject(err),
      );
    });
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  /** Center and uniformly scale an object so its longest axis equals targetSize. */
  centerAndScale(object: THREE.Object3D, targetSize = 4): void {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) return;
    const scale = targetSize / maxDim;
    object.scale.setScalar(scale);
    object.position.sub(center.multiplyScalar(scale));
  }

  /** Recursively dispose all geometries and materials of a Three.js object. */
  dispose(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.geometry?.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m: THREE.Material) => {
          // dispose any texture properties
          Object.values(m as any).forEach((val: any) => {
            if (val && typeof val === 'object' && typeof val.dispose === 'function') {
              val.dispose();
            }
          });
          m.dispose();
        });
      }
    });
  }
}
