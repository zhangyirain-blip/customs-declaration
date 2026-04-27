# 分享指南：如何把工具给同事使用

> 本工具是纯前端应用（React + IndexedDB），**无需后端服务器**，所有数据保存在浏览器本地。

---

## 方案对比

| 方案 | 难度 | 同事操作 | 网络要求 | 推荐度 |
|------|------|---------|---------|--------|
| **A. Vercel 部署** | ⭐ 极简单 | 打开链接即可 | 需要联网 | ⭐⭐⭐ 首推 |
| **B. 打包分发** | ⭐ 简单 | 解压 → 双击脚本 | 不需要 | ⭐⭐ 次推 |
| **C. 内网服务器** | ⭐⭐ 中等 | 打开内网链接 | 内网即可 | ⭐⭐ 有服务器时 |

---

## 方案 A：Vercel 部署（最推荐）

给同事一个链接，打开即用，零配置。

### 步骤

```bash
# 1. 确保项目已推送到 GitHub
# 如果没有 git 仓库，先初始化
git init
git add .
git commit -m "init"
git remote add origin https://github.com/你的用户名/报关自动化工具.git
git push -u origin main

# 2. 访问 https://vercel.com/new
# 3. 导入 GitHub 仓库
# 4. 框架选择 "Vite"，点击 Deploy
# 5. 等待 1-2 分钟，获得类似 https://customs-tool.vercel.app 的链接
```

> 已配置好 `vercel.json`，Vercel 会自动识别构建命令。

---

## 方案 B：打包分发（无需网络）

把构建产物打包成 zip，同事下载后本地运行。

### 一键打包

```bash
cd app
npm run package
```

会在项目根目录生成 `dist-packages/customs-docs-tool-v20260426.zip`。

### 同事使用方式

1. 解压 zip 文件
2. 确保安装了 [Node.js](https://nodejs.org)（LTS 版本即可）
3. 打开终端，进入解压后的文件夹
4. 运行：`node start-local.cjs`
5. 浏览器自动打开，开始使用

> 所有数据保存在浏览器 IndexedDB 中，不会上传到任何服务器。

---

## 方案 C：内网服务器部署

如果公司有内网服务器，可以部署到 nginx 或任何静态文件服务器。

### nginx 配置示例

```nginx
server {
    listen 80;
    server_name customs-tool.local;
    root /var/www/customs-tool/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Docker 方式

```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
EXPOSE 80
```

---

## 常见问题

**Q: 同事用 Safari 打开有问题？**
> 推荐使用 Chrome 或 Edge 浏览器。Safari 对 IndexedDB 和 PDF.js 支持不如 Chromium 内核稳定。

**Q: 数据会泄露吗？**
> 不会。所有数据（PI 信息、项目、模板）都保存在浏览器本地的 IndexedDB 中，不会上传到任何服务器。

**Q: 同事之间可以共享模板吗？**
> 目前模板是本地存储的。如需共享，可以在"产品模板管理"页面导出模板为 JSON，同事再导入即可。

**Q: Vercel 访问慢？**
> Vercel 服务器在海外，首次加载约 2-3MB。如果内网有服务器，建议用方案 C 部署到内网。
