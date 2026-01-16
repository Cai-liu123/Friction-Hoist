<template>
  <div id="scene-container" ref="containerRef" class="scene-container">
    <!-- three.js 场景挂载在这里 -->
    <LightDialog />

    <!-- 右上角控制面板 -->
    <div class="control-panel">
      <div class="panel-header">
        <div>
          <h3>摩擦式提升机演示</h3>
          <p>模型动画控制与视角切换</p>
        </div>
        <button class="chip-btn" @click="resetAll">复位</button>
      </div>

      <div class="panel-section">
        <div class="section-title">视角预设</div>
        <div class="view-row">
          <button @click="setView('iso')">等轴测</button>
          <button @click="setView('front')">正视图</button>
          <button @click="setView('side')">侧视图</button>
          <button @click="setView('top')">俯视图</button>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-title">
          动画控制
          <button class="chip-btn small" @click="toggleAnimation">
            {{ isAnimating ? '暂停' : '开始' }}
          </button>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-title">局部显示</div>
        <div class="view-row">
          <button @click="focusOnObject('零件5-1轴')">零件5-1轴</button>
          <button @click="focusOnObject('多绳摩擦天轮轴11')">多绳摩擦天轮轴11</button>
        </div>
        <div class="view-row">
          <button @click="focusOnObject('空物体')">空物体</button>
          <button @click="showAllModel">显示全部</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import LightDialog from './LightDialog.vue';
import bgImage from './assets/bg.jpg';

const containerRef = ref(null);
const isAnimating = ref(true);

// 需要旋转的特定轴对象（绕z轴）
const rotatingAxes = ref({
  '多绳摩擦天轮轴1': null,
  '多绳摩擦天轮轴11': null,
  '零件3-1轴': null,
  '零件5-1轴': null
});

// 需要上下运动的空物体
const emptyObj = ref(null);
const emptyObj001 = ref(null);

// 存储空物体和空物体001的初始Y位置
let emptyObjInitialY = 0;
let emptyObj001InitialY = 0;

// 当前模型半径（用于计算不同视角的相机距离）
const modelRadius = ref(3);

// 旋转速度（弧度每秒）
const rotationSpeed = 1.0;

// 定义旋转轴（参考App.vue的方式）
const ROTATION_AXIS = 'z'; // 所有旋转对象都绕z轴旋转

// 提升运动参数
const liftingSpeed = 1.5;
const liftingRange = 20.0;
let liftingTime = 0;
// 将liftingTime保存到window以便resetAll访问
window.__liftingTime = { value: 0 };

// 切换视角
const setView = (type) => {
  // 相机、控制器在 onMounted 里挂到 window 上，避免在模板中直接引用 three 对象
  const camera = window.__threeCamera;
  const controls = window.__threeControls;
  if (!camera || !controls) return;

  const r = modelRadius.value || 6;

  if (type === 'iso') {
    camera.position.set(r * 0.4, r * 0.45, r * 1.0);
  } else if (type === 'front') {
    camera.position.set(0, r * 0.15, r * 1.25);
  } else if (type === 'side') {
    camera.position.set(r * 1.25, r * 0.15, 0.01);
  } else if (type === 'top') {
    camera.position.set(0.01, r * 1.25, 0.01);
  }

  controls.target.set(0, 0, 0);
  camera.lookAt(0, 0, 0);
  controls.update();
};

// 控制函数
const toggleAnimation = () => {
  isAnimating.value = !isAnimating.value;
};

// 聚焦到指定物体
const focusOnObject = (objectName) => {
  const camera = window.__threeCamera;
  const controls = window.__threeControls;
  const model = window.__threeModel;
  const renderer = window.__threeRenderer;
  const scene = window.__threeScene;
  if (!camera || !controls || !model || !renderer || !scene) return;

  let targetObject = null;

  model.traverse((child) => {
    if (child.name === objectName) {
      targetObject = child;
    }
  });

  if (targetObject) {
    // 获取物体的世界坐标位置
    const targetPosition = new THREE.Vector3();
    targetObject.getWorldPosition(targetPosition);

    // 获取物体的边界框
    const box = new THREE.Box3().setFromObject(targetObject);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    let distance;
    let cameraOffset;

    // 为每个对象单独设置合适的距离和视角
    if (objectName === '空物体') {
      distance = Math.max(maxDim * 1, 5);
      cameraOffset = new THREE.Vector3(
        distance * 2,  // X轴偏移
        distance * 4,  // Y轴偏移（更高位置）
        distance * 3   // Z轴偏移
      );
    } else if (objectName === '零件3-1轴') {
      distance = Math.max(maxDim * 3.5, 4);
      cameraOffset = new THREE.Vector3(
        distance * 0.8,
        distance * 1.0,
        distance * 0.8
      );
    } else if (objectName === '零件5-1轴') {
      distance = Math.max(maxDim * 1, 1);
      cameraOffset = new THREE.Vector3(
        distance * 0.8,
        distance * 1.0,
        distance * 0.8
      );
    } else if (objectName === '多绳摩擦天轮轴1') {
      distance = Math.max(maxDim * 2, 4);
      cameraOffset = new THREE.Vector3(
        distance * 0,
        distance * 1.0,
        distance * 1.0
      );
    } else if (objectName === '多绳摩擦天轮轴11') {
      distance = Math.max(maxDim * 2, 4);
      cameraOffset = new THREE.Vector3(
        distance * 0,
        distance * 1.0,
        distance * 1.5
      );
    } else {
      // 其他对象使用默认设置
      distance = Math.max(maxDim * 4, 5);
      cameraOffset = new THREE.Vector3(
        distance * 0.8,
        distance * 1.2,
        distance * 0.8
      );
    }

    console.log('局部显示目标:', objectName, '位置:', targetPosition, '尺寸:', maxDim, '距离:', distance);

    // 设置控制器目标为物体中心
    controls.target.copy(targetPosition);

    camera.position.copy(targetPosition).add(cameraOffset);
    camera.lookAt(targetPosition);

    // 确保控制器正确更新
    controls.update();

    // 强制更新渲染，确保设置立即生效
    renderer.render(scene, camera);

    console.log('相机位置设置为:', camera.position, '目标:', controls.target);
  }
};

// 显示全部模型
const showAllModel = () => {
  const camera = window.__threeCamera;
  const controls = window.__threeControls;
  if (!camera || !controls) return;

  controls.target.set(0, 0, 0);
  setView('iso');
};

// 复位所有
const resetAll = () => {
  isAnimating.value = true;
  if (window.__liftingTime) {
    window.__liftingTime.value = 0;
  }
  liftingTime = 0;

  // 重置所有旋转轴对象的角度
  Object.values(rotatingAxes.value).forEach((obj) => {
    if (obj) {
      obj.rotation.z = 0;
    }
  });

  // 重置空物体和空物体001的位置
  if (emptyObj.value && emptyObjInitialY !== undefined) {
    emptyObj.value.position.y = emptyObjInitialY;
  }
  if (emptyObj001.value && emptyObj001InitialY !== undefined) {
    emptyObj001.value.position.y = emptyObj001InitialY;
  }

  // 确保模型始终锁定在世界坐标系原点
  const model = window.__threeModel;
  if (model) {
    model.rotation.set(0, 0, 0);
    model.position.set(0, 0, 0);
    // 保持缩放不变
  }

  setView('iso');
};

onMounted(() => {
  const container = containerRef.value;
  if (!container) return;

  // 1. 场景
  const scene = new THREE.Scene();
  window.__threeScene = scene;

  // 2. 加载背景图片
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(bgImage, (texture) => {
    texture.encoding = THREE.SRGBColorSpace;
    scene.background = texture;
  });

  // 3. 相机
  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    10000
  );
  camera.position.set(0, 4, 10);
  camera.lookAt(0, 0, 0);

  // 暴露给视角控制函数使用
  window.__threeCamera = camera;

  // 4. 渲染器
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  window.__threeRenderer = renderer;

  // 5. 环境光 + 平行光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7);
  scene.add(directionalLight);

  // 6. 轨道控制器
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);
  // 启用平移，允许旋转、缩放和平移
  controls.enablePan = true;

  window.__threeControls = controls;

  // 7. 加载 glb 模型
  const loader = new GLTFLoader();

  // 创建文字精灵（用于标注运动的空物体）
  const createLabelSprite = (text, color = '#ffffff') => {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(32, 96, size - 64, 64, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 56px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 + 8);

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.8, 1.8, 1.8);
    return sprite;
  };

  loader.load(
    '/models/摩擦式提升机.glb',
    (gltf) => {
      const model = gltf.scene;

      // 模型整体居中并适当缩放
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      // 将模型原点与世界坐标系重合，并居中
      model.position.sub(center);

      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      // 放大一点，让模型在视野里更占据主体
      const scale = 150/ maxAxis;
      model.scale.setScalar(scale);

      // 锁定模型的旋转、平移、缩放（确保模型始终保持在世界坐标系原点）
      model.rotation.set(0, 0, 0);
      model.position.set(0, 0, 0);
      model.scale.setScalar(scale); // 保持放大的缩放值

      // 遍历模型，查找特定的轴对象和空物体
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // 给每个零件添加随机颜色
          const randomColor = new THREE.Color();
          randomColor.setHSL(Math.random(), 0.7, 0.6); // 随机色相，固定饱和度和亮度
          
          // 创建新的材质并应用随机颜色
          child.material = new THREE.MeshStandardMaterial({
            color: randomColor,
            metalness: 0.3,
            roughness: 0.4
          });
        }

        // 记录需要上下移动的空物体
        if (child.name === '空物体') {
          emptyObj.value = child;
          emptyObjInitialY = child.position.y;
          console.log('找到空物体（上下移动）:', child);
        } else if (child.name === '空物体001') {
          emptyObj001.value = child;
          emptyObj001InitialY = child.position.y;
          console.log('找到空物体001（上下移动）:', child);
        } else if (child.name === '多绳摩擦天轮轴1') {
          rotatingAxes.value['多绳摩擦天轮轴1'] = child;
          console.log('找到多绳摩擦天轮轴1（z轴旋转）:', child);
        } else if (child.name === '多绳摩擦天轮轴11') {
          rotatingAxes.value['多绳摩擦天轮轴11'] = child;
          console.log('找到多绳摩擦天轮轴11（z轴旋转）:', child);
        } else if (child.name === '零件3-1轴') {
          rotatingAxes.value['零件3-1轴'] = child;
          console.log('找到零件3-1轴（z轴旋转）:', child);
        } else if (child.name === '零件5-1轴') {
          rotatingAxes.value['零件5-1轴'] = child;
          console.log('找到零件5-1轴（z轴旋转）:', child);
        }
      });

      console.log('旋转轴对象:', rotatingAxes.value);
      console.log('空物体:', emptyObj.value);
      console.log('空物体001:', emptyObj001.value);

      // 根据模型尺寸适当调整相机距离和控制器目标
      const radius = (maxAxis * scale) * 0.5;//可以修改模型视野尺寸
      modelRadius.value = radius;
      controls.target.set(0, 0, 0);
      // 调整相机位置，让相机更靠近模型，避免背景遮挡
      camera.position.set(radius * 0.1, radius * 0.3, radius * 1.0);
      camera.lookAt(0, 0, 0);

      // 在运动的空物体上添加标签
      if (emptyObj.value) {
        const sprite = createLabelSprite('空物体', '#ffeb3b');
        if (sprite) {
          sprite.position.set(0, radius * 0.05, 0);
          emptyObj.value.add(sprite);
        }
      }
      if (emptyObj001.value) {
        const sprite = createLabelSprite('空物体001', '#4fc3f7');
        if (sprite) {
          sprite.position.set(0, radius * 0.05, 0);
          emptyObj001.value.add(sprite);
        }
      }
      // 在旋转的轴对象上添加标签
      if (rotatingAxes.value['多绳摩擦天轮轴1']) {
        const sprite = createLabelSprite('多绳摩擦天轮轴1', '#ff8a65');
        if (sprite) {
          sprite.position.set(0, radius * 0.03, 0);
          rotatingAxes.value['多绳摩擦天轮轴1'].add(sprite);
        }
      }
      if (rotatingAxes.value['多绳摩擦天轮轴11']) {
        const sprite = createLabelSprite('多绳摩擦天轮轴11', '#ce93d8');
        if (sprite) {
          sprite.position.set(0, radius * 0.03, 0);
          rotatingAxes.value['多绳摩擦天轮轴11'].add(sprite);
        }
      }
      if (rotatingAxes.value['零件3-1轴']) {
        const sprite = createLabelSprite('零件3-1轴', '#ffb74d');
        if (sprite) {
          sprite.position.set(0, radius * 0.01, 0);
          rotatingAxes.value['零件3-1轴'].add(sprite);
        }
      }
      if (rotatingAxes.value['零件5-1轴']) {
        const sprite = createLabelSprite('零件5-1轴', '#4fc3f7');
        if (sprite) {
          sprite.position.set(0, radius * 0.01, 0);
          rotatingAxes.value['零件5-1轴'].add(sprite);
        }
      }

      window.__threeModel = model;
      scene.add(model);
    },
    undefined,
    (error) => {
      console.error('加载 摩擦式提升机.glb 失败:', error);
    }
  );

  // 8. 动画循环：让空物体绕 Z 轴旋转
  let animationId = null;
  const clock = new THREE.Clock();

  function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // 确保模型始终锁定在世界坐标系原点
    const model = window.__threeModel;
    if (model) {
      model.rotation.set(0, 0, 0);
      model.position.set(0, 0, 0);
    }

    if (isAnimating.value) {
        // 更新提升时间
        if (window.__liftingTime) {
          window.__liftingTime.value += delta * liftingSpeed;
        }
        liftingTime += delta * liftingSpeed;
        
        // 计算上下移动的偏移量
        const yOffset = Math.sin(liftingTime) * liftingRange;
        
        // 空物体和空物体001相对上下移动
        if (emptyObj.value) {
          emptyObj.value.position.y = emptyObjInitialY + yOffset;
        }
        if (emptyObj001.value) {
          // 空物体001与空物体相对移动（相位差π）
          emptyObj001.value.position.y = emptyObj001InitialY - yOffset;
        }
        
        // 指定的轴对象沿z轴使用sin函数旋转
        // 使用相同的liftingTime保持运动同步
        const rotationOffset = Math.sin(liftingTime) * rotationSpeed;
        Object.values(rotatingAxes.value).forEach((axis) => {
          if (axis) {
            // 设置旋转角度而不是累加，保持与sin函数同步
            axis.rotation.z = rotationOffset;
          }
        });
      }

    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  // 窗口自适应
  const onResize = () => {
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  window.addEventListener('resize', onResize);

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize);
    if (animationId !== null) cancelAnimationFrame(animationId);
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  });
});
</script>

<style>
.scene-container {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
}

.scene-container canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.control-panel {
  position: absolute;
  right: 16px;
  top: 16px;
  padding: 14px 16px 12px;
  background: radial-gradient(circle at top left, rgba(96, 165, 250, 0.35), rgba(15, 23, 42, 0.9));
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  min-width: 260px;
  backdrop-filter: blur(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 9;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.panel-header p {
  margin: 2px 0 0;
  font-size: 11px;
  opacity: 0.8;
}

.panel-section {
  padding-top: 6px;
  margin-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
  color: #e5e7eb;
}

.chip-btn {
  border: none;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 11px;
  cursor: pointer;
  background: rgba(15, 118, 110, 0.9);
  color: #e0f2f1;
}

.chip-btn.small {
  padding: 2px 8px;
  font-size: 10px;
}

.chip-btn:hover {
  background: rgba(13, 148, 136, 1);
}

.view-row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.view-row button {
  flex: 1;
  padding: 4px 6px;
  font-size: 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  background: #2196f3;
  color: #fff;
  white-space: nowrap;
}

.view-row button:hover {
  background: #1976d2;
}
</style>
