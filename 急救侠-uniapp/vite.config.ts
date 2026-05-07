import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  // 确保基础路径为根目录，解决 H5 端资源 404 问题
  base: '/',
  server: {
    // 禁用严格的文件系统访问限制，UniApp 插件有时需要访问外部资源
    fs: {
      strict: false,
    },
    // 显式配置开发服务器
    host: true,
    port: 5173,
  },
  // 解决部分环境下的模块解析问题
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  }
});
