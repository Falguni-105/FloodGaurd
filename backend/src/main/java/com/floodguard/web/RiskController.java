package com.floodguard.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.floodguard.dto.Dtos.*;
import com.floodguard.service.MlClient;
import com.floodguard.service.RiskService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/risk")
public class RiskController {
    private final RiskService risk;
    private final MlClient ml;

    public RiskController(RiskService risk, MlClient ml) { this.risk = risk; this.ml = ml; }

    /** Public: the live flood-risk map. */
    @GetMapping("/map")
    public List<LocalityRiskDto> map() { return risk.map(); }

    /** Public: model metrics (accuracy, feature importance) for transparency. */
    @GetMapping("/model")
    public ResponseEntity<JsonNode> model() {
        JsonNode m = ml.metrics();
        return m == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(m);
    }

    @PostMapping("/refresh")
    public List<LocalityRiskDto> refresh() { return risk.refreshAll(); }

    @PostMapping("/simulate")
    public List<LocalityRiskDto> simulate(@Valid @RequestBody SimulationRequest req) { return risk.simulate(req); }
}
