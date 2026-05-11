import app from './app'

const PORT = parseInt(process.env.PORT || '3001', 10)

app.listen(PORT, () => {
  console.log(`[急救侠] API 服务启动 — http://localhost:${PORT}`)
  console.log(`[急救侠] 健康检查: http://localhost:${PORT}/api/health`)
})
