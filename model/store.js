const Part = require('./Part.js');
const model = require('./model.js');
const errorMessages = require('../constants/errorMessages.js');
const store = {};

//Modifying part/assembly data
store.createPart = (partInfo, callback) => {
  const { id, name, description } = partInfo;
  if (model.nodes[id]) {
    return callback(errorMessages.partAlreadyExists, null);
  }
  model.nodes[id] = new Part(id, name, description);
  model.nodeOrg.allNodes.push(model.nodes[id]);
  model.nodeOrg.orphan.push(model.nodes[id]);
  return callback(null, model.nodes[id]);
};

store.createNewAssembly = (parts, callback) => {
  const { parent, child } = parts,
  parentId = parent.id,
  childId = child.id;
  if (!model.nodes[parentId] || !model.nodes[childId]) {
    return callback(errorMessages.invPartID, null);
  }

  model.nodes[parentId].children.push(model.nodes[childId]);
  store.updateAssemblyParentNode(parentId, callback);
  store.updateAssemblyChildNode(childId, callback);
};

store.updateAssembly = (parentId, childId, callback) => {
  if (!model.nodes[parentId] || !model.nodes[childId]) {
    return callback(errorMessages.invPartID, null);
  }

  const parentNode = model.nodes[parentId],
  childNode = model.nodes[childId];

  if (parentNode.children.includes(childNode)) {
    return callback(errorMessages.alreadyChild, null);
  }

  if (parentNode.type === 'orphan') {
    return store.createNewAssembly({'parent': parentNode, 'child': childNode}, callback);
  }

  parentNode.children.push(model.nodes[childId]);
  store.updateAssemblyParentNode(parentId, callback);
  store.updateAssemblyChildNode(childId, callback);
};

store.updateAssemblyParentNode = (parentId, callback) => {
  let newParentType;
  const currentType = model.nodes[parentId].type;

  if (currentType === 'orphan') {
    newParentType = 'topLvlAssembly';
  } else if (currentType === 'component') {
    newParentType = 'subAssembly';
  }

  if (newParentType) {
    store.updateNodeType(parentId, currentType, newParentType);
  }
};

store.updateAssemblyChildNode = (childId, callback) => {
  let newChildType;
  const currentChildType = model.nodes[childId].type;
  if (currentChildType === 'orphan') {
    newChildType = 'component';
  } else if (currentChildType === 'topLvlAssembly') {
    newChildType = 'subAssembly';
  } else if (currentChildType === 'component' ||
            currentChildType === 'subAssembly') {
    return callback(null, 'created');
  }
  store.updateNodeType(childId, currentChildType, newChildType);
  callback(null, 'created');
};

store.updateNodeType = (partId, oldType, newType) => {
  model.nodeOrg[oldType] = model.nodeOrg[oldType].filter((node) => {
    return node.id !== partId;
  });
  model.nodeOrg[newType].push(model.nodes[partId]);
  model.nodes[partId].type = newType;
};

//Returning part/assembly data
store.getAllParts = (callback) => {
  if (!model.nodeOrg.allNodes) {
    return callback(errorMessages.cantFindParts, null);
  }
  callback(null, model.nodeOrg.allNodes);
};

store.getAllComponents = (callback) => {
  if (!model.nodeOrg.component) {
    return callback(errorMessages.cantFindComponents, null);
  }
  callback(null, model.nodeOrg.component);
};

store.getAllOrphans = (callback) => {
  if (!model.nodeOrg.orphan) {
    return callback(errorMessages.cantFindOrphans, null);
  }
  callback(null, model.nodeOrg.orphan);
};

store.getAllContainingAssemblies = (partId, callback) => {
  if (!model.nodes[partId]) {
    return callback(errorMessages.partDoesNotExist, null);
  }

  if (model.nodes[partId].type === 'topLvlAssembly' ||
    model.nodes[partId].type === 'orphan') {
    return callback(null, []);
  }

  const containingAssemblies = store.searchforContainingAssemblies(partId);
  callback(null, containingAssemblies);
};

store.searchforContainingAssemblies = (partId) => {
  const containingAssemblies = [];
  const assemblies = model.nodeOrg.topLvlAssembly.concat(model.nodeOrg.subAssembly);
  for (let i = 0; i < assemblies.length; i++) {
    const assembly = assemblies[i];
    let childQueue = assembly.children.slice();
    while (childQueue.length) {
      const child = childQueue.pop();
      if (child.id === partId) {
        const {children, ...partWithNoChildParam} = assembly;
        containingAssemblies.push(partWithNoChildParam);
        childQueue = [];
      } else {
        childQueue.push(...child.children.slice());
      }
    }
  }
  return containingAssemblies;
};

store.getAllAssemblies = (callback) => {
  if (!model.nodeOrg.topLvlAssembly || !model.nodeOrg.subAssembly) {
    return callback(errorMessages.cantFindAssemblies, null);
  }
  const allAssemblies = model.nodeOrg.topLvlAssembly.concat(model.nodeOrg.subAssembly);
  callback(null, allAssemblies);
};

store.getAllTopLevelAssemblies = (callback) => {
  if (!model.nodeOrg.topLvlAssembly) {
    return callback(errorMessages.cantFindTopLevelAssemblies, null);
  }
  callback(null, model.nodeOrg.topLvlAssembly);
};

store.getAllSubAssemblies = (callback) => {
  if (!model.nodeOrg.subAssembly) {
    return callback(errorMessages.cantFindSubAssemblies, null);
  }
  callback(null, model.nodeOrg.subAssembly);
};

store.getAllAssemblyParts = (assemblyId, callback) => {
  if (!model.nodes[assemblyId]) {
    return callback(errorMessages.partDoesNotExist, null);
  }

  if (model.nodes[assemblyId].type !== 'topLvlAssembly' &&
      model.nodes[assemblyId].type !== 'subAssembly') {
    return callback(errorMessages.notAnAssembly, null);
  }

  const listOfChildren = store.iterateThroughAssemblyChildren(assemblyId);
  callback(null, listOfChildren);
};

store.iterateThroughAssemblyChildren = (assemblyId) => {
  const childQueue = model.nodes[assemblyId].children.slice();
  const listOfChildren = [];
  while (childQueue.length) {
    const part = childQueue.pop();
    if (part.children) {
      childQueue.push(...part.children.slice());
    }
    const {
      children,
      ...partWithNoChildParam
    } = part;
    listOfChildren.push(partWithNoChildParam);
  }
  return listOfChildren;
};

store.getTopLevelAssemblyParts = (assemblyId, callback) => {
  if (!model.nodes[assemblyId]) {
    return callback(errorMessages.partDoesNotExist, null);
  }

  if (model.nodes[assemblyId].type !== 'topLvlAssembly' &&
    model.nodes[assemblyId].type !== 'subAssembly') {
    return callback(errorMessages.notAnAssembly, null);
  }

  callback(null, model.nodes[assemblyId].children);
};

module.exports = store;