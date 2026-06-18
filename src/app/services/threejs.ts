import { Injectable, ElementRef, NgZone } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

@Injectable({
  providedIn: 'root'
})
export class ThreeJsService {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private gltfLoader: GLTFLoader;
  private textureLoader: THREE.TextureLoader;
  private currentModel: THREE.Object3D | null = null;
  private animationId: number = 0;
  private isInitialized = false;
  private houseParts: Map<string, THREE.Mesh[]> = new Map();
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;

  constructor(private ngZone: NgZone) {
    this.gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltfLoader.setDRACOLoader(dracoLoader);
    
    this.textureLoader = new THREE.TextureLoader();
  }

  initializeScene(container: ElementRef): void {
    if (this.isInitialized || !container?.nativeElement) {
      return;
    }
    
    const element = container.nativeElement;
    const width = element.clientWidth || 800;
    const height = element.clientHeight || 500;

    // Créer la scène
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    // Créer la caméra
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(10, 8, 12);
    this.camera.lookAt(0, 2, 0);

    // Créer le renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    element.appendChild(this.renderer.domElement);

    // Contrôles
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI / 2;

    // Configuration des lumières
    this.setupLighting();

    // Sol
    this.createGround();

    // Ajouter les helpers
    this.createHelpers();

    // Skybox simple
    this.createSimpleSkybox();

    this.animate();
    this.isInitialized = true;
  }

  private createHelpers(): void {
    // Grid helper
    this.gridHelper = new THREE.GridHelper(30, 30, 0x888888, 0x444444);
    const gridMaterial = this.gridHelper.material as THREE.Material;
    gridMaterial.opacity = 0.1;
    gridMaterial.transparent = true;
    this.scene.add(this.gridHelper);

    // Axes helper (caché par défaut)
    this.axesHelper = new THREE.AxesHelper(10);
    this.axesHelper.visible = false;
    this.scene.add(this.axesHelper);
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);
  }

  private createGround(): void {
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x8FBC8F,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private createSimpleSkybox(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, '#87CEEB');
      gradient.addColorStop(1, '#E0F7FF');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1, 256);
      
      const texture = new THREE.CanvasTexture(canvas);
      this.scene.background = texture;
    }
  }

  async loadModel(modelUrl: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      console.log(`Chargement du modèle: ${modelUrl}`);
      
      this.gltfLoader.load(
        modelUrl,
        (gltf) => {
          console.log('Modèle chargé avec succès');
          
          if (this.currentModel) {
            this.scene.remove(this.currentModel);
            this.houseParts.clear();
          }
          
          this.currentModel = gltf.scene;
          this.organizeHouseParts(this.currentModel);
          
          this.currentModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(mat => this.optimizeMaterial(mat));
                } else {
                  this.optimizeMaterial(child.material);
                }
              }
            }
          });
          
          this.fitModelToView();
          
          this.scene.add(this.currentModel);
          console.log('Modèle ajouté à la scène');
          resolve(gltf.scene);
        },
        (xhr) => {
          const percentage = ((xhr.loaded / xhr.total) * 100).toFixed(2);
          console.log(`Chargement: ${percentage}%`);
        },
        (error) => {
          console.error('Erreur de chargement:', error);
          const fallbackHouse = this.createFallbackHouse();
          this.scene.add(fallbackHouse);
          this.currentModel = fallbackHouse;
          resolve(fallbackHouse);
        }
      );
    });
  }

  private organizeHouseParts(model: THREE.Object3D): void {
    this.houseParts.clear();
    
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const name = child.name.toLowerCase();
        
        if (name.includes('wall') || name.includes('mur')) {
          this.addToPart('walls', child);
        } else if (name.includes('roof') || name.includes('toit')) {
          this.addToPart('roof', child);
        } else if (name.includes('window') || name.includes('fenetre')) {
          this.addToPart('windows', child);
        } else if (name.includes('door') || name.includes('porte')) {
          this.addToPart('doors', child);
        } else if (name.includes('floor') || name.includes('sol')) {
          this.addToPart('floors', child);
        }
      }
    });
  }

  private addToPart(partName: string, mesh: THREE.Mesh): void {
    if (!this.houseParts.has(partName)) {
      this.houseParts.set(partName, []);
    }
    this.houseParts.get(partName)?.push(mesh);
  }

  private optimizeMaterial(material: THREE.Material): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.roughness = 0.7;
      material.metalness = 0.2;
      material.needsUpdate = true;
    }
  }

  toggleGrid(visible: boolean): void {
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
  }

  toggleAxes(visible: boolean): void {
    if (this.axesHelper) {
      this.axesHelper.visible = visible;
    }
  }

  setLighting(intensity: number): void {
    this.scene.children.forEach(child => {
      if (child instanceof THREE.AmbientLight) {
        child.intensity = intensity * 0.4;
      } else if (child instanceof THREE.DirectionalLight) {
        child.intensity = intensity * 0.8;
      }
    });
  }

  // ... reste des méthodes ...

  private fitModelToView(): void {
    if (!this.currentModel) return;
    
    const box = new THREE.Box3().setFromObject(this.currentModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    this.currentModel.position.sub(center);
    this.currentModel.position.y = 0;
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 8;
    const scale = targetSize / maxDim;
    this.currentModel.scale.setScalar(scale);
    
    const cameraDistance = maxDim * 2;
    this.camera.position.set(cameraDistance, cameraDistance * 0.7, cameraDistance);
    this.controls.target.set(0, size.y * scale * 0.5, 0);
    this.controls.update();
  }

  changeMaterialColor(partType: string, color: string | number): void {
    if (!this.currentModel || !this.houseParts.has(partType)) return;
    
    const threeColor = typeof color === 'string' ? new THREE.Color(color) : new THREE.Color(color);
    const parts = this.houseParts.get(partType);
    
    if (parts) {
      parts.forEach(mesh => {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.color.copy(threeColor);
          mesh.material.needsUpdate = true;
        } else if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.color.copy(threeColor);
              mat.needsUpdate = true;
            }
          });
        }
      });
    }
  }

  private createFallbackHouse(): THREE.Group {
    const houseGroup = new THREE.Group();
    
    const wallGeometry = new THREE.BoxGeometry(6, 4, 6);
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xF5F5F5,
      roughness: 0.7 
    });
    const walls = new THREE.Mesh(wallGeometry, wallMaterial);
    walls.position.y = 2;
    walls.castShadow = true;
    houseGroup.add(walls);
    
    const roofGeometry = new THREE.ConeGeometry(4.5, 3, 4);
    const roofMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8B4513,
      roughness: 0.8 
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 5.5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    houseGroup.add(roof);
    
    this.houseParts.clear();
    this.houseParts.set('walls', [walls]);
    this.houseParts.set('roof', [roof]);
    
    return houseGroup;
  }

  onResize(container: ElementRef): void {
    if (!this.renderer || !this.camera || !container?.nativeElement) return;
    
    const width = container.nativeElement.clientWidth;
    const height = container.nativeElement.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  takeScreenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private animate(): void {
    this.ngZone.runOutsideAngular(() => {
      const animateLoop = () => {
        this.animationId = requestAnimationFrame(animateLoop);
        
        if (this.controls) {
          this.controls.update();
        }
        
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      };
      
      animateLoop();
    });
  }

  cleanup(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.renderer) {
      this.renderer.dispose();
      const canvas = this.renderer.domElement;
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
    
    this.houseParts.forEach(parts => {
      parts.forEach(mesh => {
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => mat.dispose());
          } else {
            (mesh.material as THREE.Material).dispose();
          }
        }
        mesh.geometry.dispose();
      });
    });
    
    this.houseParts.clear();
    this.isInitialized = false;
    this.currentModel = null;
    this.gridHelper = null;
    this.axesHelper = null;
  }
}