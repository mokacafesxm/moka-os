export default {
  id: "fermeture-bar",
  nom: "Fermeture Bar",
  zone: "Bar",
  steps: [
    {
      key: "nettoyage",
      type: "checklist",
      label: "Nettoyage",
      items: [
        "Machine à café nettoyée",
        "Plan de travail désinfecté",
        "Poubelles vidées",
        "Sol balayé et lavé",
      ],
    },
    {
      key: "produits-ranges",
      type: "checkbox",
      label: "Produits rangés",
      description: "Tous les produits périssables sont rangés au frigo",
    },
    {
      key: "temp-frigo-boissons-fermeture",
      type: "temperature",
      label: "Température frigo boissons (fermeture)",
      unit: "°C",
      min: 0,
      max: 5,
      incidentCategorie: "Hygiène",
      incidentCriticite: "Majeur",
    },
    {
      key: "caisse",
      type: "checkbox",
      label: "Caisse",
      description: "Caisse comptée et clôturée",
    },
    {
      key: "notes-fermeture",
      type: "text",
      label: "Notes de fermeture",
      description: "Remarques éventuelles (facultatif)",
    },
  ],
};
