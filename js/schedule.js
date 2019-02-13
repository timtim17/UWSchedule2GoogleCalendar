
function Schedule(newSchedule) {
  this.WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  this.scheduleData = null;

  this.parseAndSaveSchedule = function(response, todayBtn, prevBtn, nextBtn, range){
    response = JSON.parse(response);

    let classes = [];

    for (let i = 0; i < response.sections.length; i++) {
      let section = response.sections[i];

      for (let j = 0; j < section.meetings.length; j++) {

        let meeting_days = section.meetings[j].meeting_days;
        let days = [];
        for (let day in meeting_days) {
          if (meeting_days[day]) {
            days.push(day.toUpperCase().substring(0,2));
          }
        }

        let end_date = new Date(response.term.last_day_instruction);
        end_date.setDate(end_date.getDate() + 1);

        let location = section.meetings[j].building_name + " " + section.meetings[j].room;
        if (section.meetings[j].building_tbd) {
          location = "Room TBD";
        }

        let earliestDay = 10;
        for (let i = 0; i < days.length; i++) {
          let day = days[i];
          let dayIndex = this.WEEKDAYS.indexOf(day);
          if (dayIndex != -1 && dayIndex < earliestDay) {
            earliestDay = dayIndex;
          }
        }
        let first_day = new Date("2019-01-07");
        first_day.setDate(first_day.getDate() + (earliestDay + 6 - first_day.getDay()) % 7);

        let type = section.section_type.charAt(0).toUpperCase() + section.section_type.substr(1);
        if (section.final_exam && !section.final_exam.no_exam_or_nontraditional && section.final_exam.start_date && section.final_exam.building) {
          classes.push({
            "curr_abbr": section.curriculum_abbr,
            "course_num": section.course_number,
            "section_type": type,
            "course_title": section.course_title,
            "title": section.curriculum_abbr + " " + section.course_number + " (Final Exam)",
            "description": section.curriculum_abbr + " " + section.course_number + " - " + section.course_title + " (Final Exam)",
            "location": section.final_exam.building + " " + section.final_exam.room,
            "start_time": section.final_exam.start_date,
            "end_time": section.final_exam.end_date
          });
        }

        classes.push({
          "curr_abbr": section.curriculum_abbr,
          "course_num": section.course_number,
          "section_type": type,
          "course_title": section.course_title,
          "title": section.curriculum_abbr + " " + section.course_number + " (" + type + ")",
          "description": section.curriculum_abbr + " " + section.course_number + " - " + section.course_title,
          "location": location,
          "start_time": (section.meetings[j].start_time) ? (first_day.toISOString().substring(0, 10) + " " + section.meetings[j].start_time) : null,
          "end_time": (section.meetings[j].start_time) ? (first_day.toISOString().substring(0, 10) + " " + section.meetings[j].end_time) : null,
          "freq": "WEEKLY",
          "until": end_date.toString(),
          "byday": days
        });
      }
    }

    this.scheduleData = {};
    this.scheduleData.courses = classes;
    this.scheduleData.label = response.term.label;

    chrome.storage.sync.set({"scheduleData": this.scheduleData}, () => {
      console.log("Stored calendar: " + this.scheduleData);
    });
  }

  this.updateRange = function(range) {
    range.innerText = "";
    let start = this.calendar.getDateRangeStart().toDate();
    range.innerText += start.getMonth() + 1 + "/" + start.getDate();
    range.innerText += " - ";
    let end = this.calendar.getDateRangeEnd().toDate();
    range.innerText += end.getMonth() + 1 + "/" + end.getDate() + "/" + (1900 + end.getYear());
  }

  this.getRandomColor = function() {
    let letters = '56789ABC';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * letters.length)];
    }
    return color;
  }

  this.fillCalendar = function(data) {
    let schedules = [];

    let calendarSet = new Set();
    for (let i = 0; i < data.length; i++) {
      let dataEntry = data[i];
      let scheduleEntry = {};

      let startTime = new Date(dataEntry.start_time);
      let endTime = new Date(dataEntry.end_time);

      scheduleEntry["id"] = i;
      scheduleEntry["calendarId"] = dataEntry.curr_abbr + "-" + dataEntry.course_num;
      scheduleEntry["title"] = dataEntry.title;
      scheduleEntry["category"] = "time";
      scheduleEntry["start"] = startTime.toISOString();
      scheduleEntry["end"] = endTime.toISOString();
      scheduleEntry["location"] = dataEntry.location;

      calendarSet.add(scheduleEntry["calendarId"]);
      schedules.push(scheduleEntry);

      if (dataEntry.freq) {
        let untilDate = new Date(dataEntry.until);
        startTime.setDate(startTime.getDate() + 1);
        endTime.setDate(endTime.getDate() + 1);
        while (startTime.getTime() < untilDate.getTime()) {
          if (dataEntry.byday.indexOf(this.WEEKDAYS[startTime.getDay()]) == -1) {
            startTime.setDate(startTime.getDate() + 1);
            endTime.setDate(endTime.getDate() + 1);
            continue;
          }
          scheduleEntry = JSON.parse(JSON.stringify(scheduleEntry));
          scheduleEntry["start"] = startTime.toISOString();
          scheduleEntry["end"] = endTime.toISOString();
          schedules.push(scheduleEntry);

          startTime.setDate(startTime.getDate() + 1);
          endTime.setDate(endTime.getDate() + 1);
        }
      }
    }
    this.calendar.createSchedules(schedules);

    for (let id of calendarSet) {
      this.calendar.setCalendarColor(id, {
        color: '#000',
        bgColor: this.getRandomColor(),
        borderColor: '#000'
      });
    }
  }

  this.setupCalendar = function(container, todayBtn, nextBtn, prevBtn, range) {
    this.calendar = new tui.Calendar(container, {
      defaultView: 'week',
      taskView: false,
      isReadOnly: true,
      week: {
          narrowWeekend: true,
          hourStart: 7,
          hourEnd: 20
      },
      scheduleView: ['time']
    });

    this.updateRange(range);
    todayBtn.addEventListener("click", () => { this.calendar.today(); this.updateRange(range) });
    prevBtn.addEventListener("click", () => { this.calendar.prev(); this.updateRange(range) });
    nextBtn.addEventListener("click", () => { this.calendar.next(); this.updateRange(range) });

    this.getScheduleData((scheduleData) => {
      if (scheduleData) {
        this.fillCalendar(scheduleData.courses);
      } else {
        this.calendar.clear();
      }
    })

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "sync" && changes.scheduleData) {
        if (changes.scheduleData.newValue) {
          this.fillCalendar(changes.scheduleData.newValue.courses);
        } else {
          this.calendar.clear();
        }
      }
    })
  }

  this.getScheduleData = function(callback) {
    if (this.scheduleData) {
      callback(this.scheduleData);
    } else {
      chrome.storage.sync.get(["scheduleData"], (data) => {
        this.scheduleData = data.scheduleData;
        callback(this.scheduleData);
      });
    }
  }

  if (typeof newSchedule === "string") {
    this.parseAndSaveSchedule(newSchedule);
  } else {
    this.getScheduleData(console.log);
  }
}
