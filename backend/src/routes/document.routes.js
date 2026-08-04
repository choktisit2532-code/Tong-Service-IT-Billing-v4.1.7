const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const {
    documentCreateSchema, documentUpdateSchema, documentMetadataSchema, documentListSchema,
    documentStatusSchema, documentReasonSchema, sourceQuerySchema, idSchema
} = require('../validators/schemas');
const {
    createDocument, updateDocument, updateDocumentMetadata, getDocumentImpact, getDocumentById, listDocuments,
    listAvailableSources, updateDocumentStatus, cancelDocument,
    softDeleteDocument, restoreDocument, getDocumentAudit
} = require('../services/document.service');
const { clearCache } = require('../utils/cache');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('document.view'), validate(documentListSchema, 'query'), asyncHandler(async (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        Pragma: 'no-cache',
        Expires: '0'
    });
    res.json(await listDocuments(req.validatedQuery || req.query, { role: req.user.role }));
}));

router.get('/sources', authorize('document.view'), validate(sourceQuerySchema, 'query'), asyncHandler(async (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        Pragma: 'no-cache',
        Expires: '0'
    });
    const result = await listAvailableSources(req.validatedQuery || req.query);
    res.json({
        data: result.data,
        pagination: { total: result.total, has_more: result.has_more }
    });
}));

router.get('/:id/audit', authorize('audit.view'), validate(idSchema, 'params'), asyncHandler(async (req, res) => {
    res.json(await getDocumentAudit(req.params.id));
}));

router.get('/:id/impact', authorize('document.view'), validate(idSchema, 'params'), asyncHandler(async (req, res) => {
    res.json({ data: await getDocumentImpact(req.params.id) });
}));

router.get('/:id', authorize('document.view'), validate(idSchema, 'params'), asyncHandler(async (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        Pragma: 'no-cache',
        Expires: '0'
    });
    res.json({ data: await getDocumentById(req.params.id) });
}));

router.post('/', authorize('document.create'), validate(documentCreateSchema), asyncHandler(async (req, res) => {
    const data = await createDocument({ body: req.body, userId: req.user.id });
    clearCache('dashboard:');
    res.status(201).json({ data });
}));

router.put('/:id', authorize('document.update'), validate(idSchema, 'params'), validate(documentUpdateSchema), asyncHandler(async (req, res) => {
    const data = await updateDocument({
        id: req.params.id,
        body: req.body,
        userId: req.user.id,
        role: req.user.role
    });
    clearCache('dashboard:');
    res.json({ data });
}));

router.patch('/:id/metadata', authorize('document.update'), validate(idSchema, 'params'), validate(documentMetadataSchema), asyncHandler(async (req, res) => {
    const data = await updateDocumentMetadata({
        id: req.params.id,
        body: req.body,
        userId: req.user.id,
        role: req.user.role
    });
    clearCache('dashboard:');
    res.json({ data });
}));

router.patch('/:id/status', authorize('document.status'), validate(idSchema, 'params'), validate(documentStatusSchema), asyncHandler(async (req, res) => {
    if (req.body.status === 'CANCELLED') {
        const data = await cancelDocument({
            id: req.params.id,
            reason: 'ยกเลิกผ่านการเปลี่ยนสถานะ',
            userId: req.user.id,
            role: req.user.role
        });
        clearCache('dashboard:');
        return res.json({ data });
    }
    const data = await updateDocumentStatus({ id: req.params.id, status: req.body.status, userId: req.user.id });
    clearCache('dashboard:');
    return res.json({ data });
}));

router.post('/:id/cancel', authorize('document.cancel'), validate(idSchema, 'params'), validate(documentReasonSchema), asyncHandler(async (req, res) => {
    const data = await cancelDocument({
        id: req.params.id,
        reason: req.body.reason,
        userId: req.user.id,
        role: req.user.role
    });
    clearCache('dashboard:');
    res.json({ data });
}));

router.delete('/:id', authorize('document.delete'), validate(idSchema, 'params'), validate(documentReasonSchema), asyncHandler(async (req, res) => {
    const data = await softDeleteDocument({
        id: req.params.id,
        reason: req.body.reason,
        userId: req.user.id,
        role: req.user.role
    });
    clearCache('dashboard:');
    res.json({ data });
}));

router.post('/:id/restore', authorize('document.restore'), validate(idSchema, 'params'), asyncHandler(async (req, res) => {
    const data = await restoreDocument({ id: req.params.id, userId: req.user.id });
    clearCache('dashboard:');
    res.json({ data });
}));

module.exports = router;
