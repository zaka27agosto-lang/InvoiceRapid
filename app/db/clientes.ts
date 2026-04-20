import db from './database';

export function getClientes() {
  return db.getAllSync('SELECT * FROM clientes ORDER BY nombre ASC');
}

export function insertCliente(cliente: any) {
  return db.runSync(
    'INSERT INTO clientes (nombre, email, telefono, movil, pais, calle, piso, ciudad, cp, provincia, nif, persona_contacto, direccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [cliente.nombre, cliente.email, cliente.telefono, cliente.movil, cliente.pais, cliente.calle, cliente.piso, cliente.ciudad, cliente.cp, cliente.provincia, cliente.nif, cliente.persona_contacto, cliente.direccion]
  );
}

export function updateCliente(id: number, cliente: any) {
  return db.runSync(
    'UPDATE clientes SET nombre = ?, email = ?, telefono = ?, movil = ?, pais = ?, calle = ?, piso = ?, ciudad = ?, cp = ?, provincia = ?, nif = ?, persona_contacto = ?, direccion = ? WHERE id = ?',
    [cliente.nombre, cliente.email, cliente.telefono, cliente.movil, cliente.pais, cliente.calle, cliente.piso, cliente.ciudad, cliente.cp, cliente.provincia, cliente.nif, cliente.persona_contacto, cliente.direccion, id]
  );
}

export function deleteCliente(id: number) {
  return db.runSync('DELETE FROM clientes WHERE id = ?', [id]);
}