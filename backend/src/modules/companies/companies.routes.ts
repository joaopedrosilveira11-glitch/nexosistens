import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { requireTenantScope } from '../../middleware/tenant.js'
import { validateBody } from '../../middleware/validation.js'

const router = Router()
const companySchema = z.object({ name: z.string().min(2), slug: z.string().min(2), status: z.enum(['active', 'inactive']).default('active') })
router.use(authenticate)
router.use(requireTenantScope)
router.get('/', authorize(['owner', 'admin', 'manager']), (_req, res) => res.status(200).json({ companies: [] }))
router.post('/', authorize(['owner', 'admin']), validateBody(companySchema), (_req, res) => res.status(501).json({ error: 'Company persistence is not configured yet.' }))
export default router