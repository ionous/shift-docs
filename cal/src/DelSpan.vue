<script>
/*
 * if we need it, an example of swapping b/t <del> and <span>
 * ex. <DelSpan deleted=true>content</DelSpan> ==> `<del>content</del>
 */
export default {
  computed: {
    htmlEl() {
      return this.deleted ? "del" : "span";
    }
  },
  props: {
    deleted: {
      type: Boolean,
      required: true,
    }
  }
}
</script>

<!-- "slot" is the user content between the tags -->
<template>
  <component :is="htmlEl"><slot></slot></component>
</template>

<style>
</style>