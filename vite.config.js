import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: true, // 监听所有网络接口，等价于 '0.0.0.0'
    port: 5174, // 固定使用5174端口
    strictPort: true, // 严格使用指定端口，不存在时会报错
    cors: true // 允许跨域请求
  }
})
