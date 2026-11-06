export const colombianDepartments = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá, D.C.', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare',
  'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío',
  'Risaralda', 'San Andrés, Providencia y Santa Catalina', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca',
  'Vaupés', 'Vichada',
];

// Sugerencias para autocompletar. El campo de municipio permite escribir otros destinos del país.
export const commonMunicipalities = [
  'Arauca', 'Armenia', 'Barrancabermeja', 'Barranquilla', 'Bello', 'Bogotá', 'Bucaramanga', 'Buenaventura',
  'Cali', 'Cartagena', 'Cartago', 'Caucasia', 'Cereté', 'Chía', 'Chiquinquirá', 'Ciénaga', 'Cúcuta', 'Dosquebradas',
  'Duitama', 'Envigado', 'Facatativá', 'Florencia', 'Floridablanca', 'Fusagasugá', 'Girardot', 'Girón', 'Guadalajara de Buga',
  'Ibagué', 'Ipiales', 'Itagüí', 'La Dorada', 'Leticia', 'Maicao', 'Manizales', 'Medellín', 'Mitú', 'Mocoa', 'Montería',
  'Mosquera', 'Neiva', 'Ocaña', 'Palmira', 'Pasto', 'Pereira', 'Pitalito', 'Popayán', 'Puerto Asís', 'Puerto Carreño',
  'Quibdó', 'Riohacha', 'Rionegro', 'San Andrés', 'San José del Guaviare', 'Santa Marta', 'Sincelejo', 'Soacha',
  'Sogamoso', 'Soledad', 'Tuluá', 'Tunja', 'Tumaco', 'Valledupar', 'Villavicencio', 'Yopal', 'Zipaquirá',
].sort((a, b) => a.localeCompare(b, 'es'));

export function shippingPrice(department: string, municipality: string) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
  return normalize(department) === normalize('Bogotá, D.C.') ? 6000 : 15000;
}
