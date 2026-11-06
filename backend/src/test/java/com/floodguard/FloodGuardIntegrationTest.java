package com.floodguard;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * End-to-end API tests on the in-memory database. ML service and weather API
 * are unreachable/disabled on purpose, so the rule-based fallback is exercised.
 */
@SpringBootTest(properties = {
        "floodguard.ml.url=http://localhost:1",
        "floodguard.weather.enabled=false",
        "floodguard.uploads-dir=target/test-uploads" })
@AutoConfigureMockMvc
class FloodGuardIntegrationTest {
    @Autowired
    MockMvc mvc;
    @Autowired
    ObjectMapper om;

    private JsonNode json(String s) throws Exception {
        return om.readTree(s);
    }

    private String token(String path, Map<String, String> body) throws Exception {
        String res = mvc
                .perform(post(path).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsString(body)))
                .andReturn().getResponse().getContentAsString();
        return json(res).get("token").asText();
    }

    private String authority() throws Exception {
        return token("/api/auth/login", Map.of("username", "authority", "password", "Admin@123"));
    }

    private String citizen() throws Exception {
        String u = "c" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return token("/api/auth/register", Map.of("username", u, "password", "Passw0rd!x", "fullName", "Test Citizen"));
    }

    private MockMultipartHttpServletRequestBuilder report(String type, String sev) {
        return (MockMultipartHttpServletRequestBuilder) multipart("/api/incidents").param("type", type)
                .param("severity", sev)
                .param("description", "Water rising fast").param("latitude", "18.52").param("longitude", "73.85");
    }

    @Test
    void liveMapAndRoadsArePublic() throws Exception {
        mvc.perform(get("/api/risk/map")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(20));
        mvc.perform(get("/api/roads")).andExpect(status().isOk());
        mvc.perform(get("/api/facilities")).andExpect(status().isOk());
    }

    @Test
    void anonymousUsersCannotReportOrListIncidents() throws Exception {
        mvc.perform(report("WATERLOGGING", "LOW")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/incidents")).andExpect(status().isUnauthorized());
    }

    @Test
    void citizenCanReportButNotSeeControlRoomData() throws Exception {
        String t = citizen();
        mvc.perform(report("WATERLOGGING", "MEDIUM").header("Authorization", "Bearer " + t))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/incidents").header("Authorization", "Bearer " + t)).andExpect(status().isForbidden());
        mvc.perform(get("/api/dashboard/summary").header("Authorization", "Bearer " + t))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/incidents/mine").header("Authorization", "Bearer " + t))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void publicIncidentFeedHidesDescriptionAndReporter() throws Exception {
        mvc.perform(get("/api/incidents/public")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].description").doesNotExist())
                .andExpect(jsonPath("$[0].reporter").doesNotExist());
    }

    @Test
    void registrationCannotEscalateRole() throws Exception {
        String u = "e" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + u
                        + "\",\"password\":\"Passw0rd!x\",\"fullName\":\"X\",\"role\":\"ADMIN\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("CITIZEN"));
    }

    @Test
    void nonImageUploadIsRejected() throws Exception {
        String t = citizen();
        MockMultipartFile fake = new MockMultipartFile("image", "x.jpg", "image/jpeg", "not an image".getBytes());
        mvc.perform(report("WATERLOGGING", "LOW").file(fake).header("Authorization", "Bearer " + t))
                .andExpect(status().isBadRequest());
    }

    @Test
    void blockedRoadForcesDetourAndCriticalIncidentRanksFirst() throws Exception {
        String a = authority();
        // seeded demo data blocks the Viman Nagar - Hadapsar road; routing must go
        // around it
        String res = mvc.perform(get("/api/rescue/route").param("fromLat", "18.5089").param("fromLon", "73.9259")
                .param("toLat", "18.5679").param("toLon", "73.9143"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode r = json(res);
        assertThat(r.get("found").asBoolean()).isTrue();
        assertThat(r.get("detoured").asBoolean()).isTrue();
        assertThat(r.get("roads").toString()).doesNotContain("Viman Nagar - Hadapsar Road");

        mvc.perform(get("/api/rescue/plan").header("Authorization", "Bearer " + a))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].rank").value(1))
                .andExpect(jsonPath("$[0].incident.type").value("PEOPLE_TRAPPED"));
    }
}
