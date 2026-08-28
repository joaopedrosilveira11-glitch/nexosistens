import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app as backendApp } from './backend/dist/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.join(__dirname, 'dist')
const app = backendApp
const port = Number(process.env.PORT || 3000)

app.use(express.static(distPath))

app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(port, () => {
  console.log(`NEXO app listening on http://0.0.0.0:${port}`)
})
