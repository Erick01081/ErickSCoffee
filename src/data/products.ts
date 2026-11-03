// Precios en COP: son PLACEHOLDERS, cámbialos por los tuyos.
export type Product = {
  id: string; category: 'cafe' | 'metodo' | 'filtro';
  name: string; price: number; img?: string; note?: string;
  gallery?: string[];
  logoColor?: string;
  // solo cafés:
  tag?: string; process?: string; producer?: string; farm?: string; origin?: string;
  why?: string; expectation?: string;
  theme?: 'sol' | 'arco' | 'olas';
};

export const products: Product[] = [
  { id: 'ombligon', category: 'cafe', theme: 'sol', logoColor: '#17402F', name: 'Ombligón Amarillo', price: 60000,
    img: '/img/ombligon.webp', tag: 'El de las sobremesas que se alargan', process: 'Natural',
    why: 'El Ombligón Amarillo nos pareció único: es sumamente expresivo, muy dulce y fácil de beber, con un retrogusto que pocas veces hemos experimentado. Jhonatan y Johanny están al frente de la finca Nuevo Sol, buscando procesos innovadores; este café es un gran ejemplo de esa búsqueda.',
    expectation: 'Esperamos una taza muy dulce y expresiva, pero nada empalagosa. Es un café fácil de disfrutar y con un retrogusto que invita a quedarse un rato más. Esta es nuestra impresión; descubre tú tus propios matices.',
    producer: 'Jhonatan Nieto & Johanny González',
    farm: 'Nuevo Sol', origin: 'Pitalito, Huila · 1.600 msnm' },
  { id: 'sl28', category: 'cafe', theme: 'arco', logoColor: '#D81B7A', name: 'SL-28', price: 65000,
    img: '/img/sl28-served.webp', gallery: ['/img/sl28-served.webp', '/img/sl28.webp'], tag: 'El de las pausas para descubrir',
    process: 'Lavado avanzado con fermentación en mosto de variedad Gesha',
    why: 'Escogimos el SL-28 con el propósito de ofrecer un café muy expresivo y floral. Es poco común encontrar un proceso de fermentación con mosto de otra variedad, en este caso Gesha, que le aporta un toque floral único. Nos pareció una forma distinta de acercarnos a la genética SL-28.',
    expectation: 'Esperamos una taza limpia y muy expresiva, con un carácter floral que nace de su proceso. Es una invitación a descubrir una faceta poco habitual de esta variedad.', producer: 'Marlon Bolaños',
    farm: 'The Three Coffee Farmers', origin: 'San Agustín, Huila · 1.700 msnm' },
  { id: 'bourbon', category: 'cafe', theme: 'olas', logoColor: '#8E1B2E', name: 'Bourbon Rojo', price: 70000,
    img: '/img/bourbon-served.webp', gallery: ['/img/bourbon-served.webp', '/img/bourbon-rojo.webp'], tag: 'El de las tazas que se vuelven viaje', process: 'Natural · Thermal Shock',
    why: 'El Bourbon Rojo fue un gran descubrimiento durante una cata con Marlon. Desde el primer instante, su aroma y luego su fragancia nos cautivaron. Al probarlo, encontramos un café muy expresivo, pero nada invasivo, con matices llamativos que ya resultan atractivos desde el olfato.',
    expectation: 'Su proceso hace que esos aromas sean muy atractivos y, en taza, la experiencia se convierte para nosotros en un viaje sin regreso. Nos parece un café expresivo y envolvente; te invitamos a descubrir qué despierta en ti.', producer: 'Marlon Bolaños',
    farm: 'The Three Coffee Farmers', origin: 'San Agustín, Huila · 1.700 msnm' },

  { id: 'kalita', category: 'metodo', name: 'Kalita Wave 155', price: 155000, img: '/img/kalita-wave.jpg', note: 'Dripper de fondo plano tamaño 155, pensado para una extracción pareja.' },

  { id: 'cafec-abaca', category: 'filtro', name: 'Cafec Abaca V60', price: 60000, img: '/img/cafec-abaca.png', note: 'Filtro de papel de abacá para V60.' },
  { id: 'kalita-155', category: 'filtro', name: 'Kalita Wave 155', price: 55000, img: '/img/kalita-wave-155.webp', note: 'Filtros de papel para Kalita Wave tamaño 155.' },
];
