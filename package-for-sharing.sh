#!/bin/bash
# ============================================
# 一键打包分发脚本
# 将构建产物打包成可直接分发给同事的压缩包
# ============================================

set -e

APP_NAME="报关资料自动化生成工具"
VERSION=$(date +%Y%m%d)
OUTPUT_DIR="../dist-packages"
PACKAGE_NAME="customs-docs-tool-v${VERSION}"

echo "==================================="
echo "  ${APP_NAME} - 打包分发"
echo "==================================="
echo ""

# 1. 构建
echo "📦 步骤 1/3: 构建生产环境..."
npm run build

# 2. 准备分发目录
echo "📁 步骤 2/3: 准备分发文件..."
mkdir -p "${OUTPUT_DIR}/${PACKAGE_NAME}"
cp -r dist/* "${OUTPUT_DIR}/${PACKAGE_NAME}/"
cp start-local.cjs "${OUTPUT_DIR}/${PACKAGE_NAME}/"

# 3. 写入 README
cat > "${OUTPUT_DIR}/${PACKAGE_NAME}/README.txt" << 'EOF'
报关资料自动化生成工具
========================

【使用方式 - 推荐】
1. 确保已安装 Node.js (https://nodejs.org)
2. 打开终端，进入本文件夹
3. 运行: node start-local.cjs
4. 浏览器会自动打开，开始使用

【使用方式 - 备用】
直接用 Chrome 浏览器打开 index.html 文件也可以运行，
但部分功能（如 PDF 解析）体验可能稍差。

【注意事项】
- 所有数据保存在浏览器本地，不会上传到任何服务器
- 建议使用 Chrome 或 Edge 浏览器
- 首次使用建议清除浏览器缓存中的旧数据

EOF

# 4. 压缩
echo "🗜  步骤 3/3: 生成压缩包..."
cd "${OUTPUT_DIR}"
if command -v zip &> /dev/null; then
    zip -rq "${PACKAGE_NAME}.zip" "${PACKAGE_NAME}"
    echo "✅ 已生成: ${OUTPUT_DIR}/${PACKAGE_NAME}.zip"
else
    tar -czf "${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}"
    echo "✅ 已生成: ${OUTPUT_DIR}/${PACKAGE_NAME}.tar.gz"
fi

# 清理临时目录
rm -rf "${PACKAGE_NAME}"

echo ""
echo "🎉 打包完成！"
echo "📦 文件位置: ${OUTPUT_DIR}/${PACKAGE_NAME}.zip"
echo ""
echo "💡 分享给同事时，只需发送这个 zip 文件即可"
