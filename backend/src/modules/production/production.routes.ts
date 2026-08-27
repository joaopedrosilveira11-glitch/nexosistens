import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validation.js'

const router = Router()
const productionSchema = z.object({ orderId: z.string().min(1), productId: z.string().min(1), quantity: z.number().positive(), dueDate: z.string().datetime().optional(), status: z.enum(['queued', 'running', 'quality', 'done']).default('queued') })
router.use(authenticate)
router.get('/dashboard', authorize(['owner', 'admin', 'manager', 'employee']), (_req, res) => res.status(200).json({ queue: 0, inProduction: 0, capacity: null, productivity: null }))
router.post('/orders', authorize(['owner', 'admin', 'manager']), validateBody(productionSchema), (_req, res) => res.status(501).json({ error: 'Production persistence is not configured yet.' }))
export default router