#!/usr/bin/env node
/**
 * 一键本地启动脚本
 * 功能：
 * 1. 自动构建（dist/ 不存在时）
 * 2. 启动本地 HTTP 服务器
 * 3. 自动打开浏览器
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PORT = 3456
const DIST_DIR = path.join(__dirname, 'dist')

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('404 Not Found')
      return
    }
    res.writeHead(200, {
      'Content-Type': getMimeType(filePath),
      'Cache-Control': 'no-cache',
    })
    res.end(data)
  })
}

function buildIfNeeded() {
  if (fs.existsSync(DIST_DIR)) {
    const indexHtml = path.join(DIST_DIR, 'index.html')
    if (fs.existsSync(indexHtml)) {
      console.log('✅ dist/ 已存在，跳过构建')
      return
    }
  }
  console.log('📦 dist/ 不存在，正在构建...')
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname })
    console.log('✅ 构建完成')
  } catch (e) {
    console.error('❌ 构建失败，请检查错误信息')
    process.exit(1)
  }
}

function openBrowser(url) {
  const platform = process.platform
  const cmd =
    platform === 'darwin' ? 'open' :
    platform === 'win32' ? 'start' :
    'xdg-open'
  try {
    execSync(`${cmd} "${url}"`)
  } catch (e) {
    console.log(`请手动打开浏览器访问: ${url}`)
  }
}

function startServer() {
  const server = http.createServer((req, res) => {
    // CORS 支持
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    let filePath = path.join(DIST_DIR, decodeURIComponent(req.url))

    // SPA fallback: 非文件请求都返回 index.html
    const ext = path.extname(filePath)
    if (!ext || ext === '') {
      filePath = path.join(DIST_DIR, 'index.html')
    }

    // 安全检查：防止目录遍历
    if (!filePath.startsWith(DIST_DIR)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // 文件不存在，返回 index.html（SPA 路由）
        const indexPath = path.join(DIST_DIR, 'index.html')
        serveFile(indexPath, res)
        return
      }
      serveFile(filePath, res)
    })
  })

  server.listen(PORT, '0.0.0.0', () => {
    const url = `http://localhost:${PORT}`
    console.log('\n🚀 服务器已启动')
    console.log(`📍 本地访问: ${url}`)
    console.log(`📡 局域网访问: http://${getLocalIP()}:${PORT}`)
    console.log('\n按 Ctrl+C 停止服务器\n')
    openBrowser(url)
  })

  process.on('SIGINT', () => {
    console.log('\n👋 服务器已停止')
    server.close()
    process.exit(0)
  })
}

function getLocalIP() {
  const { networkInterfaces } = require('os')
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}

// ========== 主流程 ==========
console.log('=================================')
console.log('  报关资料自动化生成工具 - 本地启动')
console.log('=================================\n')

buildIfNeeded()
startServer()
