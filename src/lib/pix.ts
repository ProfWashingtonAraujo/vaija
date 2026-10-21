export type PixKeyType = 'cpf_cnpj' | 'phone' | 'email' | 'random'

export const pixKeyTypeLabels: Record<PixKeyType, string> = {
  cpf_cnpj: 'CPF ou CNPJ',
  phone: 'Celular',
  email: 'E-mail',
  random: 'Chave aleatória',
}

export type PixConfig = {
  pixKeyType?: PixKeyType
  pixKey?: string
  pixName?: string
  pixCity?: string
}

/** Chave no formato que o Pix exige: CPF/CNPJ só com números, celular com +55, e-mail em minúsculas. */
export function normalizePixKey(type: PixKeyType, raw: string) {
  const value = raw.trim()
  switch (type) {
    case 'cpf_cnpj': return value.replace(/\D/g, '')
    case 'phone': {
      const digits = value.replace(/\D/g, '')
      return digits ? `+${digits.length >= 12 && digits.startsWith('55') ? digits : `55${digits}`}` : ''
    }
    case 'email': return value.toLowerCase()
    case 'random': return value.toLowerCase()
  }
}

/** Nome e cidade do Pix: sem acento, maiúsculas, só letras, números e espaço, com o limite do padrão. */
function sanitize(text: string, max: number) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .slice(0, max)
}

/** A loja só consegue gerar Pix quando cadastrou chave, nome do recebedor e cidade. */
export function isPixConfigured(config: PixConfig | undefined) {
  return Boolean(config?.pixKey?.trim() && sanitize(config.pixName ?? '', 25) && sanitize(config.pixCity ?? '', 15))
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF) exigido no fim do código Pix. */
export function crc16(payload: string) {
  let crc = 0xffff
  for (let index = 0; index < payload.length; index++) {
    crc ^= payload.charCodeAt(index) << 8
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Código "Pix copia e cola" (BR Code estático) com o valor do pedido; o mesmo texto vira o QR Code. */
export function buildPixPayload({ config, amount, txid }: { config: PixConfig; amount: number; txid: string }) {
  const key = normalizePixKey(config.pixKeyType ?? 'cpf_cnpj', config.pixKey ?? '')
  const reference = txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const payload = [
    tlv('00', '01'),
    tlv('01', '12'),
    tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key)),
    tlv('52', '0000'),
    tlv('53', '986'),
    amount > 0 ? tlv('54', amount.toFixed(2)) : '',
    tlv('58', 'BR'),
    tlv('59', sanitize(config.pixName ?? '', 25)),
    tlv('60', sanitize(config.pixCity ?? '', 15)),
    tlv('62', tlv('05', reference)),
  ].join('')
  return `${payload}6304${crc16(`${payload}6304`)}`
}
