export function isValidProduct(product) {
  return product
    && typeof product.id === 'string'
    && typeof product.name === 'string'
    && typeof product.price === 'number'
    && typeof product.category === 'string'
    && typeof product.description === 'string'
    && typeof product.image === 'string'
    && typeof product.available === 'boolean'
}

export function isValidProductsPayload(payload) {
  return Array.isArray(payload?.products) && payload.products.every(isValidProduct)
}
