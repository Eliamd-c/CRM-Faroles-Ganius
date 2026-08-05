/**
 * NodeFactory - Factory Pattern (Cap. 7 - Creational Patterns)
 * Crea instancias de nodos sin exponer detalles de construcción
 */
class NodeFactory {
  static registry = new Map();

  /**
   * Registrar un tipo de nodo
   */
  static register(type, NodeClass, dependencies = {}) {
    NodeFactory.registry.set(type, {
      Class: NodeClass,
      dependencies
    });
  }

  /**
   * Crear nodo del tipo especificado
   */
  static create(type, config) {
    const entry = NodeFactory.registry.get(type);

    if (!entry) {
      throw new Error(`Tipo de nodo no registrado: ${type}`);
    }

    const { Class, dependencies } = entry;

    // Inyectar dependencias
    return new Class({
      ...config,
      ...dependencies
    });
  }

  /**
   * Obtener todos los tipos de nodos registrados
   */
  static getRegisteredTypes() {
    return Array.from(NodeFactory.registry.keys());
  }

  /**
   * Verificar si un tipo está registrado
   */
  static isRegistered(type) {
    return NodeFactory.registry.has(type);
  }
}

module.exports = NodeFactory;
