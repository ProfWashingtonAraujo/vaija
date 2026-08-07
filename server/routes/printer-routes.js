import { Router } from 'express'
import { addPrintJob, getQueueStats } from '../lib/queue.js'

const router = Router()

const printerConfig = {
  ip: process.env.PRINTER_IP || '192.168.1.100',
  port: parseInt(process.env.PRINTER_PORT || '9100'),
  model: process.env.PRINTER_MODEL || 'epson',
  autoPrint: true,
  printLogo: true,
  copies: parseInt(process.env.PRINT_COPIES || '1'),
  soundEnabled: true,
}

router.get('/config', (req, res) => {
  res.json(printerConfig)
})

router.put('/config', (req, res) => {
  const allowed = ['ip', 'port', 'model', 'autoPrint', 'printLogo', 'copies', 'soundEnabled']
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      printerConfig[key] = req.body[key]
    }
  }
  res.json(printerConfig)
})

router.post('/test', async (req, res) => {
  try {
    const testOrder = {
      id: 9999,
      customer: 'TESTE DE IMPRESSAO',
      phone: '(11) 99999-9999',
      address: 'Rua de Teste, 123',
      items: ['1x Pizza Margherita', '1x Coca-Cola 2L'],
      value: 45.90,
      payment: 'Pix',
      source: 'Teste',
      notes: 'Este e um cupom de teste',
    }
    const job = await addPrintJob(testOrder)
    res.json({ success: true, jobId: job.id, message: 'Job de teste adicionado à fila' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/status', async (req, res) => {
  try {
    const stats = await getQueueStats()
    res.json({
      printer: {
        ip: printerConfig.ip,
        port: printerConfig.port,
        model: printerConfig.model,
      },
      queue: stats,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/print-order', async (req, res) => {
  try {
    const order = req.body
    if (!order.id || !order.items) {
      return res.status(400).json({ error: 'Dados do pedido incompletos' })
    }
    const job = await addPrintJob(order)
    res.json({ success: true, jobId: job.id })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
