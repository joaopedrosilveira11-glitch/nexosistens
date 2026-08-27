import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { requireTenantScope } from '../../middleware/tenant.js'
import { validateBody } from '../../middleware/validation.js'

const router = Router()
const orderSchema = z.object({ customerId: z.string().min(1), orderNumber: z.string().min(2), totalAmount: z.number().nonnegative(), paymentStatus: z.enum(['pending', 'paid', 'partial']).default('pending'), status: z.enum(['draft', 'approved', 'production', 'shipped', 'delivered']).default('draft') })
router.use(authenticate)
router.use(requireTenantScope)
router.get('/', authorize(['owner', 'admin', 'manager', 'employee']), (_req, res) => res.status(200).json({ orders: [] }))
router.post('/', authorize(['owner', 'admin', 'manager']), validateBody(orderSchema), (_req, res) => res.status(501).json({ error: 'Order persistence is not configured yet.' }))
export default router