export default {
  id: "reception-livraison",
  nom: "Réception livraison",
  zone: null,
  steps: [
    {
      key: "fournisseur",
      type: "text",
      label: "Fournisseur / n° de commande",
      description: "Qui livre, et référence de la commande si connue",
    },
    {
      key: "conformite",
      type: "checklist",
      label: "Conformité livraison",
      items: [
        "Quantités conformes au bon de commande",
        "Aucun produit endommagé",
        "Dates de péremption vérifiées",
        "Chaîne du froid respectée (produits frais/surgelés)",
      ],
    },
    {
      key: "temp-reception",
      type: "temperature",
      label: "Température à réception (produits frais/surgelés)",
      unit: "°C",
      min: -20,
      max: 5,
      incidentCategorie: "Stock",
      incidentCriticite: "Majeur",
    },
    {
      key: "photo-bon-livraison",
      type: "photo",
      label: "Photo du bon de livraison",
    },
    {
      key: "notes-reception",
      type: "text",
      label: "Notes de réception",
      description: "Remarques éventuelles (facultatif)",
    },
  ],
};
