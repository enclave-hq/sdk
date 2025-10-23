import { defineConfig } from 'tsup';

export default defineConfig({
  // 入口文件
  entry: {
    index: 'src/index.ts',
    react: 'src/platforms/react/index.ts',
    vue: 'src/platforms/vue/index.ts',
    nextjs: 'src/platforms/nextjs/index.ts',
  },
  
  // 输出格式
  format: ['cjs', 'esm'],
  
  // 生成类型定义
  dts: true,
  
  // 代码分割
  splitting: false,
  
  // Sourcemap
  sourcemap: true,
  
  // 清理输出目录
  clean: true,
  
  // 外部依赖（不打包）
  external: [
    'react',
    'react-dom',
    'vue',
    'ws',
    'crypto',
  ],
  
  // 压缩（生产环境）
  minify: process.env.NODE_ENV === 'production',
  
  // Tree-shaking
  treeshake: true,
  
  // Target
  target: 'es2020',
  
  // 输出目录
  outDir: 'dist',
  
  // 使用 tsconfig.json
  tsconfig: './tsconfig.json',
  
  // 生成 package.json 类型字段
  platform: 'neutral',
  
  // 打包配置
  esbuildOptions(options) {
    options.banner = {
      js: '// Enclave SDK v2.0 - https://enclave-hq.com',
    };
  },
});

