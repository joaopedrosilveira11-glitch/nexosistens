import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validation.js'

const router = Router()
const inventoryMovementSchema = z.object({ productId: z.string().min(1), movementType: z.enum(['inbound', 'outbound', 'adjustment', 'reserved']), quantity: z.number().positive(), reference: z.string().optional() })
router.use(authenticate)
router.get('/', authorize(['owner', 'admin', 'manager', 'employee']), (_req, res) => res.status(200).json({ items: [] }))
router.post('/movements', authorize(['owner', 'admin', 'manager']), validateBody(inventoryMovementSchema), (_req, res) => res.status(501).json({ error: 'Inventory persistence is not configured yet.' }))
export default router