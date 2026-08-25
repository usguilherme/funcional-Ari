/* ============================================================
   LOCAL-DB.JS — Substituto local do Firebase (sem nuvem)
   Implementa a MESMA API usada pelo script.js original:
   firebase.initializeApp, firebase.auth(), firebase.database()
   db.ref(path).set/update/remove/push/on/once/transaction
   orderByChild/orderByKey/limitToLast (aplicados de forma simples)
   Tudo é gravado no localStorage do navegador.
   ============================================================ */

(function () {
  const STORAGE_KEY = "funcionaldoari_db";
  const AUTH_KEY = "funcionaldoari_auth_user";
  const USERS_KEY = "funcionaldoari_usuarios";

  // ---------- Utilidades de armazenamento ----------
  function lerBanco() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function salvarBanco(dados) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
  }
  function getEmPath(obj, path) {
    if (!path || path === "/") return obj;
    const partes = path.split("/").filter(Boolean);
    let atual = obj;
    for (const p of partes) {
      if (atual == null) return null;
      atual = atual[p];
    }
    return atual === undefined ? null : atual;
  }
  function setEmPath(obj, path, valor) {
    if (!path || path === "/") {
      return valor;
    }
    const partes = path.split("/").filter(Boolean);
    let atual = obj;
    for (let i = 0; i < partes.length - 1; i++) {
      const p = partes[i];
      if (typeof atual[p] !== "object" || atual[p] === null) atual[p] = {};
      atual = atual[p];
    }
    const ultima = partes[partes.length - 1];
    if (valor === null) {
      delete atual[ultima];
    } else {
      atual[ultima] = valor;
    }
    return obj;
  }
  function gerarId() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  // ---------- Sistema de listeners (para simular tempo real) ----------
  const listeners = {}; // path -> [callbacks]

  function notificar(path) {
    // Notifica listeners exatos e também os de caminhos "pai" (ex: escrever em clientes/123 notifica 'clientes')
    Object.keys(listeners).forEach((p) => {
      if (path === p || path.startsWith(p + "/") || p.startsWith(path + "/") || p === "" || path === "") {
        listeners[p].forEach((cb) => {
          const banco = lerBanco();
          cb(criarSnapshot(p, getEmPath(banco, p)));
        });
      }
    });
  }

  function criarSnapshot(path, valor) {
    return {
      val: () => (valor === undefined ? null : valor),
      exists: () => valor !== undefined && valor !== null,
      forEach: (cb) => {
        if (valor && typeof valor === "object") {
          Object.keys(valor).forEach((k) => cb(criarSnapshot(path + "/" + k, valor[k])));
        }
      },
      key: path.split("/").filter(Boolean).pop() || null,
    };
  }

  // ---------- Referência estilo Firebase Realtime Database ----------
  function Ref(path) {
    this.path = path || "";
    this._order = null;
    this._limit = null;
  }

  Ref.prototype.child = function (p) {
    return new Ref((this.path ? this.path + "/" : "") + p);
  };

  Ref.prototype.push = function (valor) {
    const id = gerarId();
    const novaRef = this.child(id);
    if (valor !== undefined) {
      novaRef.set(valor);
    }
    return novaRef;
  };

  Ref.prototype.set = function (valor) {
    return new Promise((resolve) => {
      const banco = lerBanco();
      setEmPath(banco, this.path, valor);
      salvarBanco(banco);
      notificar(this.path);
      resolve();
    });
  };

  Ref.prototype.update = function (updates) {
    return new Promise((resolve) => {
      const banco = lerBanco();
      const atual = getEmPath(banco, this.path) || {};
      const mesclado = Object.assign({}, atual, updates);
      setEmPath(banco, this.path, mesclado);
      salvarBanco(banco);
      notificar(this.path);
      resolve();
    });
  };

  Ref.prototype.remove = function () {
    return this.set(null);
  };

  Ref.prototype.transaction = function (fn) {
    return new Promise((resolve) => {
      const banco = lerBanco();
      const atual = getEmPath(banco, this.path);
      const novoValor = fn(atual);
      setEmPath(banco, this.path, novoValor === undefined ? null : novoValor);
      salvarBanco(banco);
      notificar(this.path);
      resolve({ committed: true, snapshot: criarSnapshot(this.path, novoValor) });
    });
  };

  Ref.prototype.orderByChild = function () {
    return this;
  };
  Ref.prototype.orderByKey = function () {
    return this;
  };
  Ref.prototype.limitToLast = function (n) {
    this._limit = n;
    return this;
  };
  Ref.prototype.startAt = function () {
    return this;
  };
  Ref.prototype.equalTo = function () {
    return this;
  };

  Ref.prototype.on = function (evento, callback) {
    if (evento !== "value") return;
    if (!listeners[this.path]) listeners[this.path] = [];
    listeners[this.path].push(callback);
    // Dispara imediatamente com o valor atual
    const banco = lerBanco();
    let valor = getEmPath(banco, this.path);
    valor = aplicarLimite(valor, this._limit);
    callback(criarSnapshot(this.path, valor));
  };

  Ref.prototype.once = function (evento) {
    return new Promise((resolve) => {
      const banco = lerBanco();
      let valor = getEmPath(banco, this.path);
      valor = aplicarLimite(valor, this._limit);
      resolve(criarSnapshot(this.path, valor));
    });
  };

  Ref.prototype.off = function () {
    delete listeners[this.path];
  };

  function aplicarLimite(valor, limite) {
    if (!limite || !valor || typeof valor !== "object") return valor;
    const chaves = Object.keys(valor);
    if (chaves.length <= limite) return valor;
    const ultimas = chaves.slice(chaves.length - limite);
    const recorte = {};
    ultimas.forEach((k) => (recorte[k] = valor[k]));
    return recorte;
  }

  // ---------- Banco de dados (fachada) ----------
  const database = {
    ref: function (path) {
      return new Ref(path || "");
    },
  };

  // ---------- Autenticação local simples ----------
  const authListeners = [];
  let usuarioAtual = null;

  function garantirUsuarioPadrao() {
    let usuarios = JSON.parse(localStorage.getItem(USERS_KEY) || "null");
    if (!usuarios) {
      usuarios = {
        "ari@funcionaldoari.com": { senha: "ari1234", email: "ari@funcionaldoari.com" },
      };
      localStorage.setItem(USERS_KEY, JSON.stringify(usuarios));
    }
    return usuarios;
  }

  function carregarSessao() {
    const salvo = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    usuarioAtual = salvo;
  }
  carregarSessao();
  garantirUsuarioPadrao();

  const auth = {
    get currentUser() {
      return usuarioAtual;
    },
    onAuthStateChanged: function (cb) {
      authListeners.push(cb);
      // Dispara com o estado atual (assíncrono, como o Firebase real)
      setTimeout(() => cb(usuarioAtual), 0);
    },
    signInWithEmailAndPassword: function (email, senha) {
      return new Promise((resolve, reject) => {
        const usuarios = garantirUsuarioPadrao();
        const registro = usuarios[email];
        if (registro && registro.senha === senha) {
          usuarioAtual = { email: email, uid: email };
          localStorage.setItem(AUTH_KEY, JSON.stringify(usuarioAtual));
          authListeners.forEach((cb) => cb(usuarioAtual));
          resolve(usuarioAtual);
        } else {
          reject({ message: "E-mail ou senha inválidos." });
        }
      });
    },
    signOut: function () {
      return new Promise((resolve) => {
        usuarioAtual = null;
        localStorage.removeItem(AUTH_KEY);
        authListeners.forEach((cb) => cb(null));
        resolve();
      });
    },
  };

  // reautenticação usada em "resetarSistema" — como é tudo local, só confere a senha salva
  auth.currentUser && (auth.currentUser.reauthenticateWithCredential = function () {
    return Promise.resolve();
  });

  function anexarReauth(user) {
    if (!user) return user;
    user.reauthenticateWithCredential = function (credencial) {
      return new Promise((resolve, reject) => {
        const usuarios = garantirUsuarioPadrao();
        const registro = usuarios[user.email];
        if (registro && registro.senha === credencial.senha) {
          resolve();
        } else {
          reject({ message: "Senha incorreta." });
        }
      });
    };
    return user;
  }
  anexarReauth(usuarioAtual);
  const signInOriginal = auth.signInWithEmailAndPassword;
  auth.signInWithEmailAndPassword = function (email, senha) {
    return signInOriginal(email, senha).then((user) => anexarReauth(user));
  };

  // ---------- Objeto global "firebase" (mesma superfície usada no script.js) ----------
  window.firebase = {
    apps: [],
    initializeApp: function () {
      window.firebase.apps.push(true);
    },
    auth: function () {
      return auth;
    },
    database: function () {
      return database;
    },
  };
  // credencial "fake" usada em firebase.auth.EmailAuthProvider.credential(email, senha)
  window.firebase.auth.EmailAuthProvider = {
    credential: function (email, senha) {
      return { email: email, senha: senha };
    },
  };
})();
