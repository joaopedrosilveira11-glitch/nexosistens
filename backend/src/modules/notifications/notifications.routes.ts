import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validation.js'

const router = Router()
const notificationSchema = z.object({ type: z.enum(['task', 'delay', 'order', 'stock', 'problem', 'approval', 'payment', 'purchase', 'communication']), title: z.string().min(3), message: z.string().min(3) })
router.use(authenticate)
router.get('/', authorize(['owner', 'admin', 'manager', 'employee', 'customer']), (_req, res) => res.status(200).json({ notifications: [] }))
router.post('/mark-read', authorize(['owner', 'admin', 'manager', 'employee', 'customer']), validateBody(z.object({ notificationIds: z.array(z.string()) })), (req, res) => res.status(200).json({ message: 'Notifications marked as read.', updated: req.body.notificationIds.length }))
router.post('/', authorize(['owner', 'admin', 'manager']), validateBody(notificationSchema), (_req, res) => res.status(501).json({ error: 'Notification persistence is not configured yet.' }))
export default router