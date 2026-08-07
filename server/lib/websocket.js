import { Server } from 'socket.io'

let io = null

export function initWebSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('join-room', (roomId) => {
      socket.join(roomId)
      console.log(`Socket ${socket.id} joined room ${roomId}`)
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  return io
}

export function getIO() {
  return io
}

export function emitNewOrder(order) {
  if (io) {
    io.emit('new-order', {
      id: order.id,
      customer: order.customer,
      source: order.source || 'Online',
      value: order.value,
      items: order.items,
      timestamp: new Date().toISOString(),
    })
    console.log(`Emitted new-order event for order #${order.id}`)
  }
}

export function emitOrderStatusChanged(order) {
  if (io) {
    io.emit('order-status-changed', {
      id: order.id,
      status: order.status,
      timestamp: new Date().toISOString(),
    })
  }
}

export function emitPrintJobUpdate(data) {
  if (io) {
    io.emit('print-job-update', data)
  }
}
