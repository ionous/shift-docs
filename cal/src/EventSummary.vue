<!-- 
  A summary of a cal daily on the calList overview page.
-->
<script>
import dayjs from 'dayjs'
// components:
import { RouterLink } from 'vue-router'
import CalTags from './CalTags.vue'
import EventHeader from './EventHeader.vue'
import LocationLink from './LocLink.vue'
import Term from './CalTerm.vue'
// support:
import calTags from './calTags.js'
import helpers from './calHelpers.js'
import format from './support/format.js'

export default {
  props: {
    evt: Object,
    showDate: Boolean // the summary should show the complete date.
  },
  components: { CalTags, EventHeader, LocationLink, Term },
  computed: {
    // the link uses the vue router to manipulate the url and history
    // without reloading the page.
    eventDetailsLink() {
      const { evt } = this;
      return {
        // the 'EventDetails' route description in cal/main.js
        name: 'EventDetails', 
        // the ':caldaily_id' in that route description
        // ( which becomes pieces of the url's path )
        params: {
          series_id: evt.id,
          caldaily_id: evt.caldaily_id,
          slug: helpers.slugify(evt)
        }
      };
    },
    timeRange() {
      return helpers.getTimeRange(this.evt);
    },
    longDate() {
      return format.longDate(dayjs(this.evt.date));
    },
    tags() {
      return calTags.buildEventTags(this.evt);
    }
  },
};
</script>
  <template>
  <article 
    ref="article"
    :id="`cal-${evt.caldaily_id}`"
    :data-event-id="evt.caldaily_id"
    class="c-event"
    :class="{ 'c-event--cancelled': evt.cancelled, 
              'c-event--featured': evt.featured }">
  <EventHeader :id="evt.caldaily_id" :featured="evt.featured" :hasNews="!!evt.newsflash">
    <RouterLink :to="eventDetailsLink">{{ evt.title }}</RouterLink>
  </EventHeader>
  <dl class="c-terms c-event__terms">
    <Term id="time" label="Time">
       <span v-if="showDate">{{longDate}}</span>
       <div :class="showDate? 'c-time__range--indent': 'c-time__range--inline'">{{timeRange}}</div>
    </Term>
    <Term id="news" :context="evt.caldaily_id" label="Newsflash" :text="evt.newsflash"/>
    <Term id="location" label="Location">
      <LocationLink :evt="evt"></LocationLink>
    </Term>
    <Term id="organizer" label="Organizer" :text="evt.organizer"/>
    <Term id="tags" label="Tags">
      <CalTags :tags="tags"/>
    </Term>
  </dl>
  </article>
</template>
<style>
.c-event {
  border: var(--orangey-border);
  border-radius: 20px;
  margin: 10px 20px;
  padding: 0px 1em;
}
.c-event--featured {
  background-color: var(--feature-bg);
  border: var(--orangey-border);
  padding: 0px 1em;
}
.c-event--cancelled {
  .c-event-header {
    text-decoration: line-through;
  }
  /* strike through the values of things, except for the news and the tags */
  .c-term__value:not(.c-term__value--news, .c-term__value--tags) {
    text-decoration: line-through;
  }
}
/** 
 * handle indenting when there's a full date displayed, 
 * or displaying inline when there's not
 */
.c-time__range--inline {
  display: inline;
}
.c-time__range--indent {
  margin-left: 28px;
}

</style>