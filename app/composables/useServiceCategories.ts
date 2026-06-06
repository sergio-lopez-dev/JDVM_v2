import { DEFAULT_SERVICE_CATEGORIES, type ServiceCategoryDef } from '~~/schemas'

// Categorías de la carta (configurables por el admin). Viven en
// settings.serviceCategories; si no hay, se usan las por defecto.
export function useServiceCategories() {
  const { settings, save } = useSettings()

  const categories = computed<ServiceCategoryDef[]>(() =>
    settings.value?.serviceCategories?.length
      ? settings.value.serviceCategories
      : DEFAULT_SERVICE_CATEGORIES,
  )

  const label = (id?: string) =>
    (id && categories.value.find((c) => c.id === id)?.name) || id || 'Sin categoría'

  function slugify(name: string) {
    return (
      name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'categoria'
    )
  }
  function uniqueId(base: string) {
    const taken = new Set(categories.value.map((c) => c.id))
    if (!taken.has(base)) return base
    let i = 2
    while (taken.has(`${base}-${i}`)) i++
    return `${base}-${i}`
  }

  const persist = (list: ServiceCategoryDef[]) => save({ serviceCategories: list })

  async function add(name: string) {
    const clean = name.trim()
    if (!clean) return null
    const id = uniqueId(slugify(clean))
    await persist([...categories.value, { id, name: clean }])
    return id
  }
  const rename = (id: string, name: string) =>
    persist(categories.value.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c)))
  const remove = (id: string) => persist(categories.value.filter((c) => c.id !== id))
  const reorder = (list: ServiceCategoryDef[]) => persist(list)

  return { categories, label, add, rename, remove, reorder, slugify }
}
