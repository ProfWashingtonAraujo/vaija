package app

var businessCategoryNames = map[string][]string{
	"pizzeria":      {"Pizzas Tradicionais", "Pizzas Especiais", "Pizzas Doces", "Bordas", "Porções", "Bebidas", "Adicionais"},
	"hamburger":     {"Hambúrgueres", "Combos", "Acompanhamentos", "Porções", "Sobremesas", "Bebidas", "Adicionais"},
	"restaurant":    {"Entradas", "Pratos principais", "Pratos executivos", "Acompanhamentos", "Sobremesas", "Bebidas"},
	"confectionery": {"Bolos", "Doces", "Salgados", "Kits e caixas", "Sobremesas", "Bebidas"},
	"delivery":      {"Combos", "Refeições", "Lanches", "Porções", "Sobremesas", "Bebidas", "Adicionais"},
}

func categoriesForBusinessType(businessType string) ([]Category, bool) {
	names, ok := businessCategoryNames[businessType]
	if !ok {
		return nil, false
	}
	categories := make([]Category, len(names))
	for i, name := range names {
		categories[i] = Category{Name: name, MenuEnabled: true, POSEnabled: true}
	}
	return categories, true
}
