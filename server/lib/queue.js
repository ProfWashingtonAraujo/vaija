import Bull from 'bull'
import { env } from './env.js'

let printQueue = null

export function getPrintQueue() {
  if (!printQueue) {
    printQueue = new Bull('print-jobs', env.REDIS_URL || 'redis://localhost:6379', {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    })

    printQueue.on('failed', (job, err) => {
      console.error(`Print job ${job.id} failed:`, err.message)
    })

    printQueue.on('completed', (job) => {
      console.log(`Print job ${job.id} completed successfully`)
    })
  }
  return printQueue
}

export async function addPrintJob(orderData) {
  const queue = getPrintQueue()
  const job = await queue.add({
    orderId: orderData.id,
    customer: orderData.customer,
    phone: orderData.phone,
    address: orderData.address,
    items: orderData.items,
    value: orderData.value,
    payment: orderData.payment,
    source: orderData.source || 'Online',
    tableNumber: orderData.tableNumber,
    notes: orderData.notes,
    status: orderData.status,
    createdAt: new Date().toISOString(),
  })
  console.log(`Print job ${job.id} added for order #${orderData.id}`)
  return job
}

export async function getQueueStats() {
  const queue = getPrintQueue()
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ])
  return { waiting, active, completed, failed }
}
