const ALLOWED_DOCUMENT_TYPES = {
    general: ['QT', 'IN', 'RC', 'DO'],
    private: ['QT', 'IN', 'BN', 'RC', 'DO'],
    government: ['QT', 'RC', 'DO']
};

function assertDocumentTypeAllowed(customerType, documentType) {
    return (ALLOWED_DOCUMENT_TYPES[customerType] || []).includes(documentType);
}

function allowedSourceTypes(customerType, targetType) {
    if (targetType === 'BN') return ['IN'];
    // An invoice may be raised directly from a quote or after delivery has
    // been confirmed.  Keep the same rule for general and private customers;
    // government customers do not offer IN in their permitted document types.
    if (targetType === 'IN') return ['QT', 'DO'];
    if (targetType === 'DO') return ['QT'];

    if (targetType === 'RC') {
        if (customerType === 'government') return ['DO'];
        if (customerType === 'private') return ['IN'];
        return ['IN', 'QT', 'DO'];
    }

    return [];
}

module.exports = {
    ALLOWED_DOCUMENT_TYPES,
    assertDocumentTypeAllowed,
    allowedSourceTypes
};
