// Fotos de la finca. Agrega aquí cada foto y aparecerá en /nosotros.
// 1) Copia la imagen en public/img/finca/  2) Añade una línea con src, alt (qué se ve) y caption (opcional).
export type FarmPhoto = { src: string; alt: string; caption?: string; wide?: boolean };

export const farmPhotos: FarmPhoto[] = [
  // { src: '/img/finca/cafetal.webp', alt: 'Cafetal con frutos rojos al amanecer', caption: 'El cafetal al amanecer', wide: true },
];

export const farmCopy = {
  title: 'La finca',
  intro: 'Así se ve el lugar de donde viene el café.',
};
