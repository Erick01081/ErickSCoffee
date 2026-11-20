import { products } from '../data/products';

export const grindNames: Record<string, string> = {
  bean: 'Grano entero',
  fine: 'Molienda fina para espresso',
  medium: 'Molienda media para V60, AeroPress u Origami',
  coarse: 'Molienda gruesa para prensa francesa',
};

export type CheckoutItem = {
  key: string;
  product_id: string;
  product_name: string;
  category: string;
  size: string | null;
  grind: string | null;
  title: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

export type PricedCart =
  | { ok: true; items: CheckoutItem[]; subtotal: number }
  | { ok: false; error: string };

/**
 * Valida el carrito que llega del navegador y calcula los precios desde el catálogo.
 * La clave de cada línea es `producto::tamaño::molienda`.
 */
export function priceCart(rawItems: unknown): PricedCart {
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 20) {
    return { ok: false, error: 'El carrito no tiene productos válidos.' };
  }

  const items: CheckoutItem[] = [];
  let subtotal = 0;

  for (const entry of rawItems as Array<{ key?: unknown; quantity?: unknown }>) {
    if (typeof entry?.key !== 'string' || !Number.isInteger(entry.quantity) || Number(entry.quantity) < 1 || Number(entry.quantity) > 10) {
      return { ok: false, error: 'Hay un producto o una cantidad inválida en el carrito.' };
    }

    const [productId, selectedSize, selectedGrind, ...extra] = entry.key.split('::');
    if (extra.length) return { ok: false, error: 'Hay una presentación inválida en el carrito.' };
    const product = products.find(item => item.id === productId);
    if (!product) return { ok: false, error: 'No encontramos uno de los productos del carrito.' };
    if (product.available === false) return { ok: false, error: 'Uno de los productos seleccionados estará disponible próximamente.' };

    const quantity = Number(entry.quantity);
    let unitPrice = product.price;
    let title = product.name;

    if (product.category === 'cafe') {
      const size = selectedSize || '250';
      const grind = selectedGrind || 'bean';
      if (!['250', '340'].includes(size) || !(grind in grindNames)) {
        return { ok: false, error: 'Revisa el tamaño y la molienda elegidos para cada café.' };
      }
      if (size === '340') unitPrice = product.price340 ?? product.price;
      title = `${product.name} · ${size} g · ${grindNames[grind]}`;
    } else if (selectedSize || selectedGrind) {
      return { ok: false, error: 'La presentación de uno de los productos no es válida.' };
    }

    items.push({
      key: entry.key,
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      size: product.category === 'cafe' ? selectedSize || '250' : null,
      grind: product.category === 'cafe' ? selectedGrind || 'bean' : null,
      title,
      quantity,
      unit_price: Number(unitPrice),
      amount: Number(unitPrice) * quantity,
    });
    subtotal += Number(unitPrice) * quantity;
  }

  return { ok: true, items, subtotal };
}
