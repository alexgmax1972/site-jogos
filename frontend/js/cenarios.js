// Ligação: classe escolhida -> cenário 3D (.glb) + arte do card
// Use as mesmas chaves de `classes` do seu HTML de seleção.
const CENARIOS = {
  guerreiro:  { nome: "Castelo de Eldoria",   glb: "cenarios/castelo-eldoria.glb",    arte: "img/cenarios/card_guerreiro.jpg",  fundo: "img/cenarios/fundo_guerreiro.jpg" },
  mago:       { nome: "Torre Arcana",         glb: "cenarios/torre-arcana.glb",       arte: "img/cenarios/card_mago.jpg",       fundo: "img/cenarios/fundo_mago.jpg" },
  arqueiro:   { nome: "Floresta Élfica",      glb: "cenarios/floresta-arqueiro.glb",  arte: "img/cenarios/card_arqueiro.jpg",   fundo: "img/cenarios/fundo_arqueiro.jpg" },
  paladino:   { nome: "Santuário Sagrado",    glb: "cenarios/santuario-paladino.glb", arte: "img/cenarios/card_paladino.jpg",   fundo: "img/cenarios/fundo_paladino.jpg" },
  assassino:  { nome: "Ruínas Sombrias",      glb: "cenarios/ruinas-sombrias.glb",    arte: "img/cenarios/card_assassino.jpg",  fundo: "img/cenarios/fundo_assassino.jpg" },
  druida:     { nome: "Bosque Sagrado",       glb: "cenarios/bosque-sagrado.glb",     arte: "img/cenarios/card_druida.jpg",     fundo: "img/cenarios/fundo_druida.jpg" },
  necromante: { nome: "Necrópole",            glb: "cenarios/necropole.glb",          arte: "img/cenarios/card_necromante.jpg", fundo: "img/cenarios/fundo_necromante.jpg" },
  barbaro:    { nome: "Terra de Guerra",      glb: "cenarios/terra-guerra.glb",       arte: "img/cenarios/card_barbaro.jpg",    fundo: "img/cenarios/fundo_barbaro.jpg" },
  invocador:  { nome: "Círculo Arcano",       glb: "cenarios/circulo-arcano.glb",     arte: "img/cenarios/card_invocador.jpg",  fundo: "img/cenarios/fundo_invocador.jpg" },
  cavaleiro:  { nome: "Fortaleza das Runas",  glb: "cenarios/fortaleza-runas.glb",    arte: "img/cenarios/card_cavaleiro.jpg",  fundo: "img/cenarios/fundo_cavaleiro.jpg" },
  // classes extras (sem arte no card enviado)
  monge:      { nome: "Templo do Monge",      glb: "cenarios/templo-monge.glb" },
  samurai:    { nome: "Fortaleza Samurai",    glb: "cenarios/fortaleza-samurai.glb" }
};
