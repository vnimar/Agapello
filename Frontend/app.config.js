// A configuração fica no app.json. Aqui só muda o que for preciso para o
// "Agapello Teste" (APP_VARIANT=teste, perfil "teste" do eas.json): outro nome
// e outro pacote, para ficar instalado ao lado do app normal, e o fundo do
// ícone laranja, para não confundir os dois.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== "teste") return config;

  const { backgroundImage, ...adaptiveIcon } = config.android.adaptiveIcon;
  return {
    ...config,
    name: "Agapello Teste",
    ios: { ...config.ios, bundleIdentifier: "com.vnimar.AgapeMobile.teste" },
    android: {
      ...config.android,
      package: "com.vnimar.AgapeMobile.teste",
      adaptiveIcon: { ...adaptiveIcon, backgroundColor: "#E8710A" },
    },
  };
};
