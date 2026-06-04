<script setup lang="ts">
// Valoración con estrellas. Display (readonly) o interactiva (v-model).
// SVG inline (misma geometría que el diseño) para controlar fill/stroke al 100%.
const props = withDefaults(
  defineProps<{
    modelValue?: number
    max?: number
    size?: number
    readonly?: boolean
  }>(),
  { modelValue: 0, max: 5, size: 20, readonly: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const STAR_PATH = 'M12 2.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9l6.1-.9z'

function select(value: number) {
  if (!props.readonly) emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="inline-flex items-center gap-1"
    role="img"
    :aria-label="`${modelValue} de ${max} estrellas`"
  >
    <component
      :is="readonly ? 'span' : 'button'"
      v-for="i in max"
      :key="i"
      :type="readonly ? undefined : 'button'"
      class="inline-flex leading-none"
      :class="readonly ? '' : 'cursor-pointer transition-transform hover:scale-110'"
      :aria-label="readonly ? undefined : `${i} estrella${i > 1 ? 's' : ''}`"
      @click="select(i)"
    >
      <svg
        :width="size"
        :height="size"
        viewBox="0 0 24 24"
        stroke-width="1.4"
        stroke-linejoin="round"
        :class="i <= Math.round(modelValue) ? 'text-primary' : 'text-dimmed'"
        :fill="i <= Math.round(modelValue) ? 'currentColor' : 'none'"
        stroke="currentColor"
      >
        <path :d="STAR_PATH" />
      </svg>
    </component>
  </div>
</template>
