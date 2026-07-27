export default {
  id: "ouverture-bar",
  nom: "Ouverture Bar",
  zone: "Bar",
  steps: [
    {
      key: "poste-propre",
      type: "checkbox",
      label: "Poste de travail",
      description: "Le comptoir et la zone bar sont propres et rangés",
    },
    {
      key: "mise-en-place",
      type: "checklist",
      label: "Mise en place",
      items: [
        "Machine à café allumée et purgée",
        "Lait et produits frais sortis du frigo",
        "Verres et tasses propres à disposition",
        "Caisse ouverte et fond de caisse vérifié",
      ],
    },
    {
      key: "temp-frigo-boissons",
      type: "temperature",
      label: "Température frigo boissons",
      unit: "°C",
      min: 0,
      max: 5,
      incidentCategorie: "Hygiène",
      incidentCriticite: "Majeur",
    },
    {
      key: "notes-ouverture",
      type: "text",
      label: "Notes d'ouverture",
      description: "Remarques éventuelles (facultatif)",
    },
  ],
};
